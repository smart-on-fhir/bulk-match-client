import { Algorithm } from "jsonwebtoken";
import jose from "node-jose";

export declare namespace BulkMatchClient {
  interface ConfigFileOptions {
    /**
     * FHIR server base URL. Should be set either here, or as CLI parameter
     */
    fhirUrl?: string;

    /**
     * The default reporter is "cli". That works well in terminal and
     * renders some fancy stuff like progress bars. However, this does not
     * look good when your STDOUT ends up in log files. For example, if
     * you are using this tool as part of some kind of pipeline and want to
     * maintain clean logs, then consider changing this to "text".
     *
     * Can be overridden from terminal parameter `--reporter`.
     *
     * **Defaults to `cli`**
     */
    reporter?: "cli" | "text";

    // Authorization -------------------------------------------------------

    /**
     * Ideally, this can be auto-detected from fhirUrl using metadata in the
     * CapabilityStatement or from /.well-known/smart-configuration.
     * However, if you are using this with a Bulk Data server that does not
     * provide proper metadata, you can manually set the tokenEndpoint below.
     * Leave it empty to auto-detect.
     */
    tokenUrl?: string;

    /**
     * The private key used to sign authentication tokens. This must be set
     * in the config file, unless we are connecting to open server (one
     * that has no tokenUrl)
     */
    privateKey?: JWK;

    clientId?: string;

    /**
     * When we request an access token, specify its lifetime in seconds.
     * Note that if the token expires during status pooling or during
     * download another authorization request will be made to get new token
     * and then proceed from there.
     *
     * **Defaults to `300`** (5 min)
     */
    accessTokenLifetime?: number;

    // Patient Match Kick-off parameters -------------------------------------------------
    resource?: string;
    _outputFormat?: string;
    onlySingleMatch?: boolean;
    onlyCertainMatches?: boolean;
    count?: number;

    /**
     * If true, adds `handling=lenient` to the `prefer` request header. This may
     * enable a "retry" option after certain errors. It can also be used to
     * signal the server to silently ignore unsupported parameters.
     *
     * Can be overridden from terminal parameter `--lenient`
     */
    lenient?: boolean;

    /**
     * Custom options for every request, EXCLUDING the authorization request and
     * any upload requests (in case we use remote destination).
     * @type {RequestInit}
     */
    requests: RequestInit;

    destination: string;

    log?: LoggingOptions;

    /**
     * If the server does not provide `Retry-after` header use this number of
     * milliseconds before checking the status again
     */
    retryAfterMSec?: number;

    /**
     * ResponseHeaders to include in error logs for debugging purposes
     * When 'all' is specified, all responseHeaders are returned
     * When 'none' is specified, no responseHeaders are returned
     * Otherwise, log any responseHeaders matches against 1...* strings/regexp
     * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
     */
    logResponseHeaders: "all" | "none" | string | RegExp | (string | RegExp)[];

    // Download ------------------------------------------------------------
    /**
     * How many downloads to run in parallel. This will speed up the
     * download but can also overload the server. Don't be too greedy and
     * don't set this to more than 10!
     *
     * **Defaults to `5`**
     */
    parallelDownloads?: number;

    /**
     * In some cases it might be useful to also save the export manifest
     * file along with the downloaded NDJSON files.
     * **Defaults to `false`**
     */
    saveManifest?: boolean;

    // Post processing options ---------------------------------------------

    /**
     * While parsing NDJSON files every single (non-empty) line is parsed
     * as JSON. It is recommended to set a reasonable limit for the line
     * length so that a huge line does not consume the entire memory.
     *
     * **Defaults to `1000000`**
     */
    ndjsonMaxLineLength?: number;

    /**
     * If the server reports the file `count` in the export manifest,
     * verify that the number of resources found in the file matches the
     * count reported by the server.
     *
     * **Defaults to `true`**
     */
    ndjsonValidateFHIRResourceCount?: boolean;

    /**
     * The original export manifest will have an `url` property for each
     * file, containing the source location. It his is set to `true`, add
     * a `destination` property to each file containing the path (relative
     * to the manifest file) to the saved file.
     *
     * This is ONLY useful if `saveManifest` is set to `true`.
     *
     * **Defaults to `false`**
     */
    addDestinationToManifest?: boolean;
  }

  interface LoggingOptions {
    enabled?: boolean;

    /**
     * Key/value pairs to be added to every log entry. Can be used to add
     * useful information, for example which site imported this data.
     */
    metadata?: Record<string, any>;

    /**
     * Path to log file. Absolute, or relative to process CWD. If not
     * provided, the file will be called log.ndjson and will be stored in
     * the downloads folder.
     */
    file?: string;
  }

  interface CLIOptions {
    /**
     * FHIR server base URL. Must be set either as parameter or in the
     * configuration file.
     */
    fhirUrl?: string;

    /**
     * Patient Match Kick-off parameters
     * TODO: Support inline resource list based on file path?
     */
    resource?: string;
    _outputFormat?: string;
    onlySingleMatch?: boolean;
    onlyCertainMatches?: boolean;
    count?: number;

    custom?: string[];

    /**
     * Relative path to config file. Defaults to "config.js".
     */
    config?: string;

    reporter?: "cli" | "text";

    /**
     * Use if you have a status endpoint of an export that has already been
     * started.
     */
    status?: string;
  }

  interface NormalizedOptions {
    /**
     * FHIR server base URL
     */
    fhirUrl: string;

    /**
     * The Bulk Data server token URL ("none" for open servers)
     */
    tokenUrl: string;

    /**
     * The private key used to sign authentication tokens
     */
    privateKey: jose.JWK.Key;

    clientId: string;

    scope?: string;

    accessTokenLifetime: number;

    reporter: "cli" | "text";

    /**
     * Patient Matching kick off parameters
     */
    resource: string;
    onlySingleMatch?: boolean;
    _outputFormat?: string;
    onlyCertainMatches?: boolean;
    count?: number;

    /**
     * If true, adds `handling=lenient` to the `prefer` request header. This may
     * enable a "retry" option after certain errors. It can also be used to
     * signal the server to silently ignore unsupported parameters.
     *
     * Can be overridden from terminal parameter `--lenient`
     */
    lenient: boolean;

    requests: RequestInit;

    // Destination options -------------------------------------------------

    /**
     * Examples:
     * - `s3://bucket-name/optional-subfolder/` - Upload to S3
     * - `./downloads` - Save to local folder (relative to the config file)
     * - `downloads` - Save to local folder (relative to the config file)
     * - `/path/to/downloads` - Save to local folder (absolute path)
     * - `file:///path/to/downloads` - Save to local folder (file url)
     * - `http://destination.dev` - POST to http
     * - `http://username:password@destination.dev` - POST to http with basic auth
     * - `""` - do nothing
     * - `"none"` - do nothing
     *
     * **Defaults to `./downloads`**
     */
    destination: string;

    log: LoggingOptions;

    /**
     * If the server does not provide `Retry-after` header use this number of
     * milliseconds before checking the status again
     */
    retryAfterMSec: number;

    // Download ------------------------------------------------------------
    /**
     * How many downloads to run in parallel. This will speed up the
     * download but can also overload the server. Don't be too greedy and
     * don't set this to more than 10!
     *
     * **Defaults to `5`**
     */
    parallelDownloads: number;

    /**
     * In some cases it might be useful to also save the export manifest
     * file along with the downloaded NDJSON files.
     * **Defaults to `false`**
     */
    saveManifest: boolean;

    // Post processing options ---------------------------------------------

    /**
     * While parsing NDJSON files every single (non-empty) line is parsed
     * as JSON. It is recommended to set a reasonable limit for the line
     * length so that a huge line does not consume the entire memory.
     *
     * **Defaults to `1000000`**
     */
    ndjsonMaxLineLength: number;

    /**
     * If the server reports the file `count` in the export manifest,
     * verify that the number of resources found in the file matches the
     * count reported by the server.
     *
     * **Defaults to `true`**
     */
    ndjsonValidateFHIRResourceCount: boolean;

    /**
     * The original export manifest will have an `url` property for each
     * file, containing the source location. It his is set to `true`, add
     * a `destination` property to each file containing the path (relative
     * to the manifest file) to the saved file.
     *
     * This is ONLY useful if `saveManifest` is set to `true`.
     *
     * **Defaults to `false`**
     */
    addDestinationToManifest: boolean;

    /**
     * ResponseHeaders to include in error logs for debugging purposes
     * When 'all' is specified, all responseHeaders are returned
     * When 'none' is specified, no responseHeaders are returned
     * Otherwise, log any responseHeaders matches against 1...* strings/regexp
     * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
     */
    logResponseHeaders: "all" | "none" | string | RegExp | (string | RegExp)[];
  }

  interface JWK {
    alg: Algorithm;
    [key: string]: any;
  }

  interface TokenResponse {
    access_token: string;
  }

  interface MatchManifest {
    /**
     * indicates the server's time when the query is run. The response
     * SHOULD NOT include any resources modified after this instant,
     * and SHALL include any matching resources modified up to and
     * including this instant.
     * Note: To properly meet these constraints, a FHIR Server might need
     * to wait for any pending transactions to resolve in its database
     * before starting the export process.
     */
    transactionTime: string; // FHIR instant

    /**
     * the full URL of the original bulk data kick-off request
     */
    request: string;

    /**
     * indicates whether downloading the generated files requires a
     * bearer access token.
     * Value SHALL be true if both the file server and the FHIR API server
     * control access using OAuth 2.0 bearer tokens. Value MAY be false for
     * file servers that use access-control schemes other than OAuth 2.0,
     * such as downloads from Amazon S3 bucket URLs or verifiable file
     * servers within an organization's firewall.
     */
    requiresAccessToken: boolean;

    /**
     * an array of file items with one entry for each generated file.
     * If no resources are returned from the kick-off request, the server
     * SHOULD return an empty array.
     */
    output: MatchManifestFile[];

    /**
     * array of error file items following the same structure as the output
     * array.
     * Errors that occurred during the export should only be included here
     * (not in output). If no errors occurred, the server SHOULD return an
     * empty array. Only the OperationOutcome resource type is currently
     * supported, so a server SHALL generate files in the same format as
     * bulk data output files that contain OperationOutcome resources.
     */
    error: MatchManifestFile<"OperationOutcome">[];

    /**
     * An array of deleted file items following the same structure as the
     * output array.
     *
     * When a `_since` timestamp is supplied in the export request, this
     * array SHALL be populated with output files containing FHIR
     * Transaction Bundles that indicate which FHIR resources would have
     * been returned, but have been deleted subsequent to that date. If no
     * resources have been deleted or the _since parameter was not supplied,
     * the server MAY omit this key or MAY return an empty array.
     *
     * Each line in the output file SHALL contain a FHIR Bundle with a type
     * of transaction which SHALL contain one or more entry items that
     * reflect a deleted resource. In each entry, the request.url and
     * request.method elements SHALL be populated. The request.method
     * element SHALL be set to DELETE.
     *
     * Example deleted resource bundle (represents one line in output file):
     * @example
     * ```json
     * {
     *     "resourceType": "Bundle",
     *     "id": "bundle-transaction",
     *     "meta": { "lastUpdated": "2020-04-27T02:56:00Z" },
     *     "type": "transaction",
     *     "entry":[{
     *         "request": { "method": "DELETE", "url": "Patient/123" }
     *         ...
     *     }]
     * }
     * ```
     */
    deleted?: MatchManifestFile<"Bundle">[];

    /**
     * To support extensions, this implementation guide reserves the name
     * extension and will never define a field with that name, allowing
     * server implementations to use it to provide custom behavior and
     * information. For example, a server may choose to provide a custom
     * extension that contains a decryption key for encrypted ndjson files.
     * The value of an extension element SHALL be a pre-coordinated JSON
     * object.
     */
    extension?: Record<string, any>;
  }

  interface MatchManifestFile<Type = string> {
    /**
     * the FHIR resource type that is contained in the file.
     * Each file SHALL contain resources of only one type, but a server MAY
     * create more than one file for each resource type returned. The number
     * of resources contained in a file MAY vary between servers. If no data
     * are found for a resource, the server SHOULD NOT return an output item
     * for that resource in the response. These rules apply only to top-level
     * resources within the response; as always in FHIR, any resource MAY
     * have a "contained" array that includes referenced resources of other
     * types.
     */
    type: Type;

    /**
     * the path to the file. The format of the file SHOULD reflect that
     * requested in the _outputFormat parameter of the initial kick-off
     * request.
     */
    url: string;

    /**
     * the number of resources in the file, represented as a JSON number.
     */
    count?: number;
  }

  // export type StatusResponse<T=MatchManifest | OperationOutcome | void> = Response<T>

  interface KickOffParams {
    resources?: string;
    onlySingleMatch?: boolean;
    onlyCertainMatches?: boolean;
    count?: number;
  }

  interface FileDownload {
    /**
     * The file URL
     */
    readonly url: string;

    /**
     * The file display name (typically the URL basename)
     */
    readonly name: string;

    /**
     * Download processing error (if any)
     */
    error: Error | null;

    /**
     * The value shows which part of the manifest this download comes from.
     * Can be:
     * - "output"  - For exported files
     * - "deleted" - The "deleted" bundles
     * - "error"   - For ndjson files with error operation outcomes
     */
    readonly exportType: "output" | "deleted" | "error";
  }

  interface TokenResponse {
    token_type: "bearer";
    scope: "string";
    expires_in?: number;
    access_token: string;
  }

  interface MatchStatus {
    startedAt: number;
    completedAt: number;
    elapsedTime: number;
    percentComplete: number;
    nextCheckAfter: number;
    message: string;
    xProgressHeader?: string;
    retryAfterHeader?: string;
    body?: any;
    virtual?: boolean;
    statusEndpoint: string;
  }

  type ResponseHeaders = Headers;

  type AugmentedRequestInit = RequestInit & {
    context?: Record<string, unknown>;
  };
}

export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export type JsonArray = JsonValue[];
