"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_jose_1 = __importDefault(require("node-jose"));
const stream_1 = require("stream");
const util_1 = require("util");
const request_1 = __importDefault(require("../lib/request"));
const utils_1 = require("../lib/utils");
const debug = (0, util_1.debuglog)("bulk-match-SOF-client");
/**
 * This class provides all the methods needed for authenticating using BackendServices auth,
 * refreshing auth tokens, and making authenticated requests to FHIR servers
 *
 */
class SmartOnFhirClient extends stream_1.EventEmitter {
    /**
     * Nothing special is done here - just remember the options and create
     * AbortController instance
     */
    constructor(options) {
        super();
        /**
         * The last known access token is stored here. It will be renewed when it expires.
         */
        this.accessToken = "";
        /**
         * Every time we get new access token, we set this field
         * based on the token's expiration time.
         */
        this.accessTokenExpiresAt = 0;
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
    abort() {
        this.abortController.abort();
    }
    /**
     * Used internally to make requests that will automatically authorize if
     * needed and that can be aborted using [this.abort()]
     * @param url the URL to make the request to
     * @param options Any request options
     * @param label Used to render an error message if the request is aborted
     */
    async _request(url, options = {}, label = "request") {
        const _options = {
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
        const accessToken = await this.getAccessToken();
        if (accessToken) {
            _options.headers = {
                ..._options.headers,
                authorization: `Bearer ${accessToken}`,
            };
        }
        const req = (0, request_1.default)(url, _options);
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
    async getAccessToken() {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }
        const { tokenUrl, clientId, accessTokenLifetime, privateKey } = this.options;
        if (!tokenUrl || tokenUrl == "none" || !clientId || !privateKey) {
            return "";
        }
        const claims = {
            iss: clientId,
            sub: clientId,
            aud: tokenUrl,
            exp: Math.round(Date.now() / 1000) + accessTokenLifetime,
            jti: node_jose_1.default.util.randomBytes(10).toString("hex"),
        };
        const token = jsonwebtoken_1.default.sign(claims, privateKey.toPEM(true), {
            algorithm: privateKey.alg,
            keyid: privateKey.kid,
        });
        const authRequestFormData = new URLSearchParams();
        // Default scope should be "system/Patient.rs",
        authRequestFormData.append("scope", this.options.scope || "system/Patient.rs");
        authRequestFormData.append("grant_type", "client_credentials");
        authRequestFormData.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
        authRequestFormData.append("client_assertion", token);
        const authRequest = (0, request_1.default)(tokenUrl, {
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
            const json = res.body;
            console.log(json);
            (0, utils_1.assert)(json, "Authorization request got empty body");
            (0, utils_1.assert)(json.access_token, "Authorization response does not include access_token");
            (0, utils_1.assert)(json.expires_in, "Authorization response does not include expires_in");
            this.accessToken = json.access_token || "";
            this.accessTokenExpiresAt = (0, utils_1.getAccessTokenExpiration)(json);
            this.emit("authorize", this.accessToken);
            return json.access_token;
        })
            .finally(() => {
            this.abortController.signal.removeEventListener("abort", abort);
        });
    }
}
exports.default = SmartOnFhirClient;
