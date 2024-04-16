/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { FhirResource } from "fhir/r4";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { default as fsPromises } from "fs/promises";
import path, { basename, join, resolve, sep } from "path";
import { EventEmitter } from "stream";
import { URL, fileURLToPath } from "url";
import { debuglog } from "util";
import { Logger } from "winston";
import { BulkMatchClient as Types } from "../..";
import { BulkMatchClientEvents } from "../events";
import { Errors, FileDownload, Utils } from "../lib";
import SmartOnFhirClient from "./SmartOnFhirClient";

const debug = debuglog("bulk-match-client");

interface BulkMatchClient {
  on<U extends keyof BulkMatchClientEvents>(
    event: U,
    listener: BulkMatchClientEvents[U],
  ): this;
  // on(event: string, listener: Function): this;

  emit<U extends keyof BulkMatchClientEvents>(
    event: U,
    ...args: Parameters<BulkMatchClientEvents[U]>
  ): boolean;
  // emit(event: string, ...args: any[]): boolean;
}

/**
 * This class provides all the methods needed for making Bulk matches and
 * downloading data fom bulk match capable FHIR server.
 *
 * **Example:**
 * ```ts
 * const client = new Client({ ...options })
 *
 * // Start an match and get the status location
 * const statusEndpoint = await client.kickOff()
 *
 * // Wait for the match and get the manifest
 * const manifest = await client.waitForMatch(statusEndpoint)
 *
 * // Download everything in the manifest
 * const downloads = await client.downloadAllFiles(manifest)
 * ```
 */
class BulkMatchClient extends EventEmitter {
  options: Types.NormalizedOptions;
  client: SmartOnFhirClient;
  // Encapsulation used to access SmartOnFhirClient
  constructor(options: Types.NormalizedOptions) {
    super();
    this.options = options;
    this.client = new SmartOnFhirClient(options);
  }

  /**
   * Internal method for formatting response headers for some emitted events
   * based on `options.logResponseHeaders`
   * @param headers Response Headers to format
   * @returns an object representation of only the relevant headers
   */
  public formatResponseHeaders(
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
      return Utils.filterResponseHeaders(headers, [
        this.options.logResponseHeaders,
      ]);
    }
    // Else it must be an array
    return Utils.filterResponseHeaders(
      headers,
      this.options.logResponseHeaders,
    );
  }

  /**
   * Makes the kick-off request for Patient Match and resolves with the status endpoint URL
   */
  public async kickOff(): Promise<string> {
    const { fhirUrl } = this.options;

    const url = new URL("Patient/$bulk-match", fhirUrl);

    let capabilityStatement = {};
    try {
      capabilityStatement = await Utils.getCapabilityStatement(fhirUrl);
    } catch {
      capabilityStatement = {};
    }

    const requestOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        accept: "application/fhir+ndjson",
        prefer: `respond-async`,
      },
    };

    requestOptions.method = "POST";
    // Body must be stringified
    requestOptions.body = JSON.stringify(this.buildKickoffPayload());
    this.emit("kickOffStart", requestOptions, String(url));

    return this.client
      ._request(url, requestOptions, "kick-off patient match request")
      .then(async (res) => {
        const location = res.headers.get("content-location");
        if (!location) {
          throw new Error(
            "The kick-off patient match response did not include content-location header",
          );
        }
        this.emit("kickOffEnd", {
          response: res,
          requestOptions: requestOptions,
          capabilityStatement: capabilityStatement as fhir4.CapabilityStatement,
          responseHeaders: this.formatResponseHeaders(res.headers),
        });
        return location;
      })
      .catch((error) => {
        this.emit("kickOffError", error);
        throw error;
      });
  }

  /**
   * Parses all possible string representations of resources into JSON
   * @param resource A resource parameter either as a filePath or stringified JSON
   * @returns JSON representation of FHIR resource(s) to match
   */
  protected _parseResourceStringOption(resource: string): JSON {
    let localResource;
    // String resources can be inline JSON as string or paths to files
    try {
      localResource = JSON.parse(resource) as JSON;
    } catch {
      try {
        // let resourcePath = resource;
        // Should resolve both relative and absolute paths, assuming they are valid relative to CWD
        // if (!path.isAbsolute(resource)) {
        const resourcePath = path.resolve(resource);
        // }
        localResource = JSON.parse(readFileSync(resourcePath, "utf8")) as JSON;
      } catch (e) {
        // Isn't stringified JSON or a valid path, must be incorrectly specified
        throw new Error(
          `Unknown string value provided as resource; must be valid, stringified JSON or valid filePath. Instead received: ${resource}`,
        );
      }
    }
    return localResource;
  }

  /**
   * Parses all possible resource parameter representations into a standard format – an array of resources to match
   * @param resource A resource parameter to match against
   * @returns FHIR resources to match, represented as an array
   */
  protected _parseResourceOption(
    resource: Types.MatchResource,
  ): FhirResource[] {
    let localResource = resource as unknown;
    // Turn strings into JSON representation
    if (typeof resource === "string") {
      localResource = this._parseResourceStringOption(resource);
    }
    // Then turn all JSON into JsonArray
    if (Array.isArray(localResource)) {
      // noop – already an array
    } else {
      // Else, must be an object – needs to be turned into an array
      localResource = [localResource];
    }
    return localResource as FhirResource[];
  }

  /**
   * Build a POST-request JSON payload for a bulk match request
   * @returns
   */
  protected buildKickoffPayload(): fhir4.Parameters {
    const parameters: fhir4.ParametersParameter[] = [];

    // resource --------------------------------------------------------------
    const resource = this._parseResourceOption(this.options.resource);
    resource.forEach((res: FhirResource) => {
      parameters.push({
        name: "resource",
        resource: res,
      });
    });

    // _outputFormat ----------------------------------------------------------
    if (this.options._outputFormat) {
      parameters.push({
        name: "_outputFormat",
        valueString: this.options._outputFormat,
      });
    }

    // onlySingleMatch ---------------------------------------------------------------
    if (this.options.onlySingleMatch) {
      parameters.push({
        name: "onlySingleMatch",
        valueBoolean: Boolean(this.options.onlySingleMatch),
      });
    }

    // onlyCertainMatches -----------------------------------------------------------
    if (this.options.onlyCertainMatches) {
      parameters.push({
        name: "onlyCertainMatches",
        valueBoolean: Boolean(this.options.onlyCertainMatches),
      });
    }

    // count -------------------------------------------------------------
    if (this.options.count) {
      parameters.push({
        name: "count",
        valueInteger: parseInt(String(this.options.count), 10),
      });
    }

    return {
      resourceType: "Parameters",
      parameter: parameters,
    };
  }

  /**
   * Handle the completed workflow of MatchStatus requests
   * @param status The MatchStatus
   * @param res The completed response from the relevant statusEndpoint
   * @returns A Promise resolving to a MatchManifest
   */
  private async _statusCompleted(
    status: Types.MatchStatus,
    res: Response,
  ): Promise<Types.MatchManifest> {
    const now = Date.now();
    const elapsedTime = now - status.startedAt;
    status.completedAt = now;
    status.percentComplete = 100;
    status.nextCheckAfter = -1;
    status.message = `Patient Match completed in ${Utils.formatDuration(
      elapsedTime,
    )}`;

    this.emit("matchProgress", { ...status, virtual: true });
    let body = "";
    try {
      // This should throw a TypeError if the response is not parsable as JSON
      // TODO: Add more checks here based on return type of match operation
      body = await res.text();
      debug("statusCompleted successfully");
      Utils.assert(body !== null, "No match manifest returned");
      // expect(body.output, "The match manifest output is not an array").to.be.an.array();
      // expect(body.output, "The match manifest output contains no files").to.not.be.empty()
      this.emit("matchComplete", JSON.parse(body));
    } catch (ex) {
      debug("StatusCompleted In ERROR ");
      this.emit("matchError", {
        body: body || null,
        code: res.status || null,
        message: (ex as Error).message,
        responseHeaders: this.formatResponseHeaders(res.headers),
      });
      throw ex;
    }
    return JSON.parse(body) as Types.MatchManifest;
  }

  /**
   * Handle the pending workflow of MatchStatus requests, tracking metadata, calculating wait-time delays
   * and recursively calling checkStatus again
   * @param status The MatchStatus
   * @param statusEndpoint The endpoint against which statusRequests are made; needed to recursively call checkStatus
   * @param res The pending response from statusEndpoint
   * @returns A promise that waits, then invokes checkStatus again, ultimately resolving to a MatchManifest (or throwing an error)
   */
  private async _statusPending(
    status: Types.MatchStatus,
    statusEndpoint: string,
    res: Response,
  ): Promise<Types.MatchManifest> {
    const now = Date.now();
    const elapsedTime = now - status.startedAt;

    const progress = String(res.headers.get("x-progress") || "").trim();
    const retryAfter = String(res.headers.get("retry-after") || "").trim();
    const progressPct = parseInt(progress, 10);

    let retryAfterMSec = this.options.retryAfterMSec;
    if (retryAfter) {
      if (retryAfter.match(/\d+/)) {
        retryAfterMSec = parseInt(retryAfter, 10) * 1000;
      } else {
        const d = new Date(retryAfter);
        retryAfterMSec = Math.ceil(d.getTime() - now);
      }
    }

    const poolDelay = Math.min(Math.max(retryAfterMSec, 100), 1000 * 60);

    Object.assign(status, {
      percentComplete: isNaN(progressPct) ? -1 : progressPct,
      nextCheckAfter: poolDelay,
      message: isNaN(progressPct)
        ? `Patient Match: in progress for ${Utils.formatDuration(elapsedTime)}${
            progress ? ". Server message: " + progress : ""
          }`
        : `Patient Match: ${progressPct}% complete in ${Utils.formatDuration(
            elapsedTime,
          )}`,
    });

    this.emit("matchProgress", {
      ...status,
      retryAfterHeader: retryAfter,
      xProgressHeader: progress,
      body: res.body,
    });

    return Utils.wait(poolDelay, this.client.abortController.signal).then(() =>
      this.checkStatus(status, statusEndpoint),
    );
  }

  /**
   * Produce the error to throw when MatchStatus requests produce an unexpected response status
   * @param status The MatchStatus
   * @param res The statusEndpoint response
   * @returns An error to be thrown
   */
  private async _statusError(
    status: Types.MatchStatus,
    res: Response,
  ): Promise<Error> {
    const msg = `Unexpected status response ${res.status} ${res.statusText}`;
    const body = await res.text();
    this.emit("matchError", {
      body: body || null,
      code: res.status || null,
      message: msg,
      responseHeaders: this.formatResponseHeaders(res.headers),
    });

    const error = new Error(msg);
    return error;
  }

  /**
   * A indirectly recursive method for making status requests and handling completion, pending and error cases
   * @param status The MatchStatus up to this point
   * @param statusEndpoint The statusEndpoint where we check on the status of the match request
   * @returns A Promise resolving to a MatchManifest (or throws an error)
   */
  public async checkStatus(
    status: Types.MatchStatus,
    statusEndpoint: string,
  ): Promise<Types.MatchManifest> {
    debug("Making a status call");
    return this.client
      ._request(
        statusEndpoint,
        {
          headers: {
            accept: "application/json, application/fhir+ndjson",
          },
        },
        "status request",
      )
      .then(async (res: Response) => {
        const now = Date.now();
        const elapsedTime = now - status.startedAt;

        status.elapsedTime = elapsedTime;

        // match is complete
        if (res.status === 200) {
          debug("COMPLETED STATUS REQUEST, RETURNING AFTER PARSING RESPONSE");
          return this._statusCompleted(status, res);
        }

        // match is in progress
        if (res.status === 202) {
          return this._statusPending(status, statusEndpoint, res);
        }
        // Match Error - await the error then throw it
        else {
          throw await this._statusError(status, res);
        }
      });
  }

  /**
   * Waits for the patient match to be completed and resolves with the export
   * manifest when done. Emits one "matchStart", multiple "matchProgress"
   * and one "matchComplete" events.
   *
   * If the server replies with "retry-after" header we will use that to
   * compute our pooling frequency, but the next pool will be scheduled for
   * not sooner than 1 second and not later than 10 seconds from now.
   * Otherwise, the default pooling frequency is 1 second.
   */
  public async waitForMatch(
    statusEndpoint: string,
  ): Promise<Types.MatchManifest> {
    debug("Waiting for match to complete, making status requests");
    const status = {
      startedAt: Date.now(),
      completedAt: -1,
      elapsedTime: 0,
      percentComplete: -1,
      nextCheckAfter: 1000,
      message: "Patient Match started",
      xProgressHeader: "",
      retryAfterHeader: "",
      statusEndpoint,
    };

    this.emit("matchStart", status);

    return this.checkStatus(status, statusEndpoint);
  }

  /**
   * Download all the ndsjson files specified in the match-response's manifest
   * @param manifest
   * @returns
   */
  public async downloadAllFiles(
    manifest: Types.MatchManifest,
  ): Promise<Types.FileDownload[]> {
    debug("Downloading All Files");
    return new Promise(() => {
      const createDownloadJob = async (
        f: Types.MatchManifestFile,
        initialState: Partial<Types.FileDownload> = {},
      ): Promise<Types.FileDownload> => {
        const fileName = basename(f.url);

        const downloadMetadata: Types.FileDownload = {
          url: f.url,
          name: fileName,
          exportType: "output",
          error: null,
          ...initialState,
        };
        await this.downloadFile({
          file: f,
          fileName,
          authorize: manifest.requiresAccessToken,
          subFolder:
            downloadMetadata.exportType === "output"
              ? ""
              : downloadMetadata.exportType,
          exportType: downloadMetadata.exportType,
        });

        if (this.options.addDestinationToManifest) {
          f.destination = join(
            this.options.destination,
            downloadMetadata.exportType === "output"
              ? ""
              : downloadMetadata.exportType,
            fileName,
          );
        }
        return downloadMetadata;
      };

      const downloadJobs = [
        ...(manifest.output || []).map((f) =>
          createDownloadJob(f, { exportType: "output" }),
        ),
        ...(manifest.error || []).map((f) =>
          createDownloadJob(f, { exportType: "error" }),
        ),
      ];

      Promise.allSettled(downloadJobs).then((downloadOutcomes) => {
        debug("All downloads settled, processing them and saving manifest");
        // Save manifest if requested
        if (this.options.saveManifest) {
          this.saveFile(JSON.stringify(manifest, null, 4), "manifest.json");
        }
        // Get outcome of downloads if they succeeded; else get failure instances
        const downloads = downloadOutcomes.map((outcome) => {
          if (outcome.status === "fulfilled") {
            return outcome.value;
          } else {
            return outcome;
          }
        });
        this.emit("allDownloadsComplete", downloads);
      });
    });
  }

  /**
   * Download a file from a provided URL
   * @param param0
   * @returns
   */
  protected async downloadFile({
    file,
    fileName,
    authorize = false,
    subFolder = "",
    exportType = "output",
  }: {
    file: Types.MatchManifestFile;
    fileName: string;
    authorize?: boolean;
    subFolder?: string;
    exportType?: string;
  }): Promise<void> {
    debug("Download starting for ", file);
    let accessToken = "";

    if (authorize) {
      accessToken = await this.client.getAccessToken();
    }

    this.emit("downloadStart", {
      fileUrl: file.url,
      itemType: exportType,
    });

    const download = new FileDownload(file.url);

    // Start the download, then parse as json
    return download
      .run({
        accessToken,
        signal: this.client.abortController.signal,
        requestOptions: this.options.requests,
      })
      .then(async (resp) => {
        // Download is finished – emit event and save file off
        this.emit("downloadComplete", {
          fileUrl: file.url,
        });
        const response = await resp.text();
        debug(`Response for ${fileName}: ${response}`);
        await this.saveFile(response, fileName, subFolder);
      })
      .catch((e) => {
        if (e instanceof Errors.FileDownloadError) {
          this.emit("downloadError", {
            body: null,
            code: e.code || null,
            fileUrl: e.fileUrl,
            message: String(e.message || "File download failed"),
            responseHeaders: this.formatResponseHeaders(e.responseHeaders),
          });
        }
        throw e;
      });
  }

  /**
   * Internal method for saving downloaded files to memory
   * @param data The information to save
   * @param fileName The name of the file to use
   * @param subFolder Where that file should live
   * @returns A promise corresponding to that save operation
   */
  protected async saveFile(
    data: string,
    fileName: string,
    subFolder = "",
  ): Promise<void> {
    debug(
      `Saving ${fileName} ${subFolder ? `with subfolder ${subFolder}` : ""}`,
    );
    const destination = String(this.options.destination || "none").trim();
    // No destination, write nothing ---------------------------------------
    if (!destination || destination.toLowerCase() === "none") {
      return;
    }

    // local filesystem destinations ---------------------------------------
    let path = destination.startsWith("file://")
      ? fileURLToPath(destination)
      : destination.startsWith(sep)
        ? destination
        : resolve(__dirname, "../..", destination);

    Utils.assert(existsSync(path), `Destination "${path}" does not exist`);
    Utils.assert(
      statSync(path).isDirectory,
      `Destination "${path}" is not a directory`,
    );

    // Create any necessary subfolders (for error responses)
    if (subFolder) {
      path = join(path, subFolder);
      if (!existsSync(path)) {
        mkdirSync(path);
      }
    }

    // Finally write the file to disc
    return fsPromises.writeFile(join(path, fileName), data);
  }

  /**
   * Cancels an active matching request
   * @param statusEndpoint
   * @returns
   */
  public cancelMatch(statusEndpoint: string) {
    debug("Cancelling match request at statusEndpoint: ", statusEndpoint);
    this.client.abort();
    return this.client._request(statusEndpoint, {
      method: "DELETE",
    });
  }

  /**
   * Connects a logger
   * @param log
   */
  public addLogger(logger: Logger) {
    const startTime = Date.now();

    // kickoff -----------------------------------------------------------------
    this.on(
      "kickOffEnd",
      ({ capabilityStatement, response, responseHeaders, requestOptions }) => {
        logger.log("info", {
          eventId: "kickoff",
          eventDetail: {
            exportUrl: response.url,
            errorCode: response.status >= 400 ? response.status : null,
            errorBody: response.status >= 400 ? response.body : null,
            softwareName: capabilityStatement.software?.name || null,
            softwareVersion: capabilityStatement.software?.version || null,
            softwareReleaseDate:
              capabilityStatement.software?.releaseDate || null,
            fhirVersion: capabilityStatement.fhirVersion || null,
            requestOptions: requestOptions,
            responseHeaders,
          },
        });
      },
    );

    // status_progress ---------------------------------------------------------
    this.on("matchProgress", (e) => {
      if (!e.virtual) {
        // skip the artificially triggered 100% event
        logger.log("info", {
          eventId: "status_progress",
          eventDetail: {
            body: e.body,
            xProgress: e.xProgressHeader,
            retryAfter: e.retryAfterHeader,
          },
        });
      }
    });

    // status_error ------------------------------------------------------------
    this.on("matchError", (eventDetail) => {
      logger.log("error", {
        eventId: "status_error",
        eventDetail,
      });
    });

    // status_complete ---------------------------------------------------------
    this.on("matchComplete", (manifest) => {
      logger.log("info", {
        eventId: "status_complete",
        eventDetail: {
          transactionTime: manifest.transactionTime,
          outputFileCount: manifest.output.length,
          errorFileCount: manifest.error.length,
        },
      });
    });

    // download_request --------------------------------------------------------
    this.on("downloadStart", (eventDetail) => {
      logger.log("info", { eventId: "download_request", eventDetail });
    });

    // download_complete -------------------------------------------------------
    this.on("downloadComplete", (eventDetail) => {
      logger.log("info", { eventId: "download_complete", eventDetail });
    });

    // download_error ----------------------------------------------------------
    this.on("downloadError", (eventDetail) => {
      logger.log("info", { eventId: "download_error", eventDetail });
    });

    // export_complete ---------------------------------------------------------
    this.on("allDownloadsComplete", (downloads) => {
      const eventDetail = {
        files: 0,
        resources: 0,
        bytes: 0,
        duration: Date.now() - startTime,
      };

      // TODO: Add download object back in?
      downloads.forEach(() => {
        eventDetail.files += 1;
      });

      logger.log("info", { eventId: "export_complete", eventDetail });
    });
  }
  public abort() {
    this.client.abort();
  }
}

export default BulkMatchClient;
