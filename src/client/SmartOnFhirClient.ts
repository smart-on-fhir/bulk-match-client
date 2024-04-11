import { debuglog } from "util";
import jwt from "jsonwebtoken";
import jose from "node-jose";
import { URL, fileURLToPath } from "url";
import { EventEmitter } from "events";
import request from "../lib/request";
import { BulkMatchClient as Types } from "../..";
import {
  assert,
  filterResponseHeaders,
  getAccessTokenExpiration,
} from "../lib/utils";
import { FhirResource } from "fhir/r4";

EventEmitter.defaultMaxListeners = 30;

const debug = debuglog("bulk-match-SOF-client");

/**>>
 * The SmartOnFhirClient instances emit the following events:
 */
export interface SmartOnFhirClientEvents {
  /**
   * Emitted every time new access token is received
   * @event
   */
  authorize: (this: SmartOnFhirClient, accessToken: string) => void;

  /**
   * Emitted on error
   * @event
   */
  error: (this: SmartOnFhirClient, error: Error) => void;

  /**
   * Emitted when the flow is aborted by the user
   * @event
   */
  abort: (this: SmartOnFhirClient) => void;
}

interface SmartOnFhirClient {
  on<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    listener: SmartOnFhirClientEvents[U],
  ): this;
  // on(event: string, listener: Function): this;

  emit<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    ...args: Parameters<SmartOnFhirClientEvents[U]>
  ): boolean;
  // emit(event: string, ...args: any[]): boolean;

  off<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    listener: SmartOnFhirClientEvents[U],
  ): this;
  // on(event: string, listener: Function): this;
}

/**
 * This class provides all the methods needed for authenticating using BackendServices auth,
 * refreshing auth tokens, and making authenticated requests to FHIR servers
 *
 */
class SmartOnFhirClient extends EventEmitter {
  /**
   * The options of the instance
   */
  readonly options: Types.NormalizedOptions;

  /**
   * Used internally to emit abort signals to pending requests and other async jobs.
   */
  protected abortController: AbortController;

  /**
   * The last known access token is stored here. It will be renewed when it expires.
   */
  protected accessToken: string = "";

  /**
   * Every time we get new access token, we set this field
   * based on the token's expiration time.
   */
  protected accessTokenExpiresAt: number = 0;

  /**
   * Nothing special is done here - just remember the options and create
   * AbortController instance
   */
  constructor(options: Types.NormalizedOptions) {
    super();
    this.options = options;
    this.abortController = new AbortController();
    this.abortController.signal.addEventListener("abort", () => {
      this.emit("abort");
    });
  }

  /**
   * Abort any current asynchronous task. This may include:
   * - pending HTTP requests
   * - wait timers
   * - streams and stream pipelines
   */
  public abort() {
    this.abortController.abort();
  }

  /**
   * Used internally to make requests that will automatically authorize if
   * needed and that can be aborted using [this.abort()]
   * @param url the URL to make the request to
   * @param options Any request options
   * @param label Used to render an error message if the request is aborted
   */
  protected async _request(
    url: RequestInfo | URL,
    options: RequestInit,
    label = "request",
  ): Promise<Response> {
    const _options: Types.AugmentedRequestInit = {
      ...this.options.requests,
      ...options,
      headers: {
        ...this.options.requests?.headers,
        ...options.headers,
      },
      // This should abort requests when the AbortController goes off
      signal: this.abortController.signal,
      context: {
        interactive: this.options.reporter === "cli",
      },
    };

    const accessToken = await this._getAccessToken();

    if (accessToken) {
      _options.headers = {
        ..._options.headers,
        authorization: `Bearer ${accessToken}`,
      };
    }
    const req = request(url, _options as any);

    const abort = () => {
      debug(`Aborting ${label}`);
    };

    this.abortController.signal.addEventListener("abort", abort, {
      once: true,
    });

    return req.then((res) => {
      this.abortController.signal.removeEventListener("abort", abort);
      return res;
    });
  }

  /**
   * Get an access token to be used as bearer in requests to the server.
   * The token is cached so that we don't have to authorize on every request.
   * If the token is expired (or will expire in the next 10 seconds), a new
   * one will be requested and cached.
   */
  protected async _getAccessToken() {
    if (
      this.accessToken &&
      this.accessTokenExpiresAt - 10 > Date.now() / 1000
    ) {
      return this.accessToken;
    }

    const { tokenUrl, clientId, accessTokenLifetime, privateKey } =
      this.options;
    if (!tokenUrl || tokenUrl == "none" || !clientId || !privateKey) {
      return "";
    }

    const claims = {
      iss: clientId,
      sub: clientId,
      aud: tokenUrl,
      exp: Math.round(Date.now() / 1000) + accessTokenLifetime,
      jti: jose.util.randomBytes(10).toString("hex"),
    };

    const token = jwt.sign(claims, privateKey.toPEM(true), {
      algorithm: privateKey.alg as jwt.Algorithm,
      keyid: privateKey.kid,
    });

    const authRequestFormData = new FormData();
    authRequestFormData.append("scope", this.options.scope || "system/*.read");
    authRequestFormData.append("grant_type", "client_credentials");
    authRequestFormData.append(
      "client_assertion_type",
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    authRequestFormData.append("client_assertion", token);

    const authRequest = request<Types.TokenResponse>(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: authRequestFormData,
    });

    const abort = () => {
      debug("Aborting authorization request");
    };

    this.abortController.signal.addEventListener("abort", abort, {
      once: true,
    });

    return authRequest
      .then(async (res) => {
        const json = await res.json();
        assert(json, "Authorization request got empty body");
        assert(
          json.access_token,
          "Authorization response does not include access_token",
        );
        assert(
          json.expires_in,
          "Authorization response does not include expires_in",
        );
        this.accessToken = json.access_token || "";
        this.accessTokenExpiresAt = getAccessTokenExpiration(json);
        this.emit("authorize", this.accessToken);
        return json.access_token;
      })
      .finally(() => {
        this.abortController.signal.removeEventListener("abort", abort);
      });
  }

  /**
   * Internal method for formatting response headers for some emitted events
   * based on `options.logResponseHeaders`
   * @param headers Response Headers to format
   * @returns an object representation of only the relevant headers
   */
  protected _formatResponseHeaders(
    headers: Types.ResponseHeaders,
  ): object | undefined {
    if (
      this.options.logResponseHeaders.toString().toLocaleLowerCase() === "none"
    )
      return undefined;
    if (
      this.options.logResponseHeaders.toString().toLocaleLowerCase() === "all"
    )
      return Object.fromEntries(headers);
    // If not an array it must be a string or a RegExp
    if (!Array.isArray(this.options.logResponseHeaders)) {
      return filterResponseHeaders(headers, [this.options.logResponseHeaders]);
    }
    // Else it must be an array
    return filterResponseHeaders(headers, this.options.logResponseHeaders);
  }
}

export default SmartOnFhirClient;
