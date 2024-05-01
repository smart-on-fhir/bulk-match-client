import { Algorithm } from "jsonwebtoken";

export declare namespace BulkMatchClient {
  // Request related types –------------------------------------------------------------------------
  /**
   * The request-helper controlled response object, which
   * contains the original Response and the response's parsed body,
   */
  type CustomBodyResponse<T> = {
    response: Response;
    body: T;
  };
  type ResponseHeaders = Headers;

  type AugmentedRequestInit = RequestInit & {
    context?: Record<string, unknown>;
  };

  // Config-related subtypes -----------------------------------------------------------------------
  /*
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
  type Reporter = "cli" | "text";

  /**
   * An object controlling logging behavior; provided by config file
   */
  interface LoggingOptions {
    /**
     * Should logging be enabled?
     * Defaults to true
     */
    enabled?: boolean;

    /**
     * Key/value pairs to be added to every log entry. Can be used to add
     * useful information, for example which site imported this data.
     */
    metadata?: Record<string, unknown>;

    /**
     * Path to log file. Absolute, or relative to process CWD. If not
     * provided, the file will be called log.ndjson and will be stored in
     * the downloads folder.
     */
    file?: string;
  }

  /**
   * The FHIR resource(s) to match
   * Can take the following forms
   *    - "/User/absolute/path/to/dir/containing/json"
   *    - "./relative/absolute/path/to/dir/containing/json"
   *    - "/User/absolute/path/to/fhir.json"
   *    - "./relative/absolute/path/to/fhir.json"
   *    - "/User/absolute/path/to/fhir.ndjson"
   *    - "./relative/absolute/path/to/fhir.ndjson"
   *    - "{"resourceType": "Patient"}" A string representation of the resource
   *    - {"resourceType": "Patient"} An inline object resresenting the resource
   *    - [{"resourceType": "Patient", "id": 1}, {"resourceType": "Patient", "id": 2}] An inline array
   *      of resources to match
   */
  type MatchResource = string | JsonObject | JsonArray;

  /**
   * A very loose JSON Web Key interface
   */
  interface JWK {
    // Must specify an algorithm
    alg: Algorithm;
    // It will also have other properties
    [key: string]: unknown;
  }

  // Config Options --------------------------------------------------------------------------------

  /**
   * All match-client configuration options specifiable from the CLI;
   * all CLI options are optional since they can be defined elsewhere
   */
  interface CLIOptions {
    /**
     * FHIR server base URL. Must be set either as parameter or in the
     * configuration file.
     */
    fhirUrl?: string;

    // Patient Match Kick-off parameters -----------------------------------------------------------
    /**
     * More detailed options seen in the above type definition
     */
    resource?: MatchResource;
    /**
     * Output formats you expect from the server
     */
    _outputFormat?: string;
    /**
     * Should the server respond only with a single match?
     */
    onlySingleMatch?: boolean;
    /**
     * Should the server only respond with certain matches?
     */
    onlyCertainMatches?: boolean;
    /**
     * The maximum number of records to return per resource
     */
    count?: number;

    /**
     * Relative path to config file. Defaults to "config.js".
     */
    config?: string;

    /**
     * The kind of reporter to use when logging activity
     */
    reporter?: Reporter;

    /**
     * Use if you have a status endpoint of an export that has already been
     * started.
     */
    status?: string;
  }

  /**
   * All match-client configuration options specifiable from the config file
   */
  interface ConfigFileOptions {
    /**
     * FHIR server base URL. Should be set either here, or as CLI parameter
     */
    fhirUrl?: string;

    // Patient Match Kick-off parameters -----------------------------------------------------------
    /**
     * More detailed options seen in the above type definition
     */
    resource?: MatchResource;
    /**
     * Optional: Output formats you expect from the server
     */
    _outputFormat?: string;
    /**
     * Optional: Should the server respond only with a single match?
     */
    onlySingleMatch?: boolean;
    /**
     * Optional: Should the server only respond with certain matches?
     */
    onlyCertainMatches?: boolean;
    /**
     * Optional: The maximum number of records to return per resource
     */
    count?: number;

    // Authorization -------------------------------------------------------------------------------
    /**
     * Ideally, this can be auto-detected from fhirUrl using metadata in the
     * CapabilityStatement or from /.well-known/smart-configuration.
     * However, if you are using this with a Bulk Match server that does not
     * provide proper metadata, you can manually set the tokenEndpoint below.
     * Leave it empty to auto-detect.
     */
    tokenUrl?: string;

    /**
     * The private key used to sign authentication tokens. This must be set
     * in the config file, unless we are connecting to open server (one
     * that has no tokenUrl)
     *
     * Use a loose definition in the config-file options
     */
    privateKey?: JWK;

    /**
     * The client id to include in authenticated requests
     * Not needed if connecting to open servers
     */
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

    // Request Modifications -----------------------------------------------------------------------

    /**
     * Custom options for every request, EXCLUDING the authorization request and
     * any upload requests (in case we use remote destination).
     * @type {AugmentedRequestInit}
     */
    requests?: AugmentedRequestInit;

    /**
     * If the server does not provide `Retry-after` header use this number of
     * milliseconds before checking the status again
     */
    retryAfterMSec?: number;

    // Download ------------------------------------------------------------------------------------

    /**
     * The destination where patient match payloads should be
     */
    destination: string;

    /**
     * In some cases it might be useful to also save the export manifest
     * file along with the downloaded NDJSON files.
     * **Defaults to `false`**
     */
    saveManifest?: boolean;

    /**
     * The original export manifest will have an `url` property for each
     * file, containing the source location. If this is set to `true`, add
     * a `destination` property to each file containing the path (relative
     * to the manifest file) to the saved file.
     *
     * This is ONLY useful if `saveManifest` is set to `true`.
     *
     * **Defaults to `false`**
     */
    addDestinationToManifest?: boolean;

    // Logging and output --------------------------------------------------------------------------

    /**
     * ResponseHeaders to include in error logs for debugging purposes
     * When 'all' is specified, all responseHeaders are returned
     * When 'none' is specified, no responseHeaders are returned
     * Otherwise, log any responseHeaders matches against 1...* strings/regexp
     * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
     */
    logResponseHeaders: "all" | "none" | string | RegExp | (string | RegExp)[];

    /**
     * Where information should be reported in real-time
     */
    reporter?: Reporter;

    /**
     * Logging options for winston logging
     */
    log?: LoggingOptions;
  }

  /**
   * All match-client configuration options, after combining the CLI options and the ConfigFile options
   * Additionally, some auth metadata is stored here
   */
  interface NormalizedOptions {
    /**
     * FHIR server base URL
     */
    fhirUrl: string;

    // Patient Match Kick-off parameters -----------------------------------------------------------
    /**
     * More detailed options seen in the above type definition
     */
    resource: MatchResource;
    /**
     * Optional: Output formats you expect from the server
     */
    _outputFormat?: string;
    /**
     * Optional: Should the server respond only with a single match?
     */
    onlySingleMatch?: boolean;
    /**
     * Optional: Should the server only respond with certain matches?
     */
    onlyCertainMatches?: boolean;
    /**
     * Optional: The maximum number of records to return per resource
     */
    count?: number;

    // Authorization -------------------------------------------------------------------------------

    /**
     * The Bulk Match server token URL ("none" for open servers)
     */
    tokenUrl: string;

    /**
     * Ideally, this can be auto-detected from fhirUrl using metadata in the
     * CapabilityStatement or from /.well-known/smart-configuration.
     * However, if you are using this with a Bulk Match server that does not
     * provide proper metadata, you can manually set the tokenEndpoint below.
     * Leave it empty to auto-detect.
     */
    tokenUrl?: string;

    /**
     * The private key used to sign authentication tokens. This must be set
     * in the config file, unless we are connecting to open server (one
     * that has no tokenUrl); should be empty object in that case
     */
    privateKey: jose.JWK.Key;

    /**
     * The client id to include in authenticated requests
     * Not needed if connecting to open servers, should be empty-string in that case
     */
    clientId: string;

    /**
     * When we request an access token, specify its lifetime in seconds.
     * Note that if the token expires during status pooling or during
     * download another authorization request will be made to get new token
     * and then proceed from there.
     *
     * **Defaults to `300`** (5 min)
     */
    accessTokenLifetime: number;

    /**
     * The scope to use in the authorization request. If not set, defaults to
     * "system/Patient.rs"
     */
    scope: string;

    // Request Modifications -----------------------------------------------------------------------

    /**
     * If the server does not provide `Retry-after` header use this number of
     * milliseconds before checking the status again
     */
    retryAfterMSec: number;

    /**
     * Optional: Modifications to RequestInit to be applied on every request
     */
    requests?: AugmentedRequestInit;

    // Destination options -------------------------------------------------------------------------

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

    // Download ------------------------------------------------------------------------------------
    /**
     * In some cases it might be useful to also save the export manifest
     * file along with the downloaded NDJSON files.
     * **Defaults to `false`**
     */
    saveManifest: boolean;

    /**
     * The original export manifest will have an `url` property for each
     * file, containing the source location. If this is set to `true`, add
     * a `destination` property to each file containing the path (relative
     * to the manifest file) to the saved file.
     *
     * This is ONLY useful if `saveManifest` is set to `true`.
     *
     * **Defaults to `false`**
     */
    addDestinationToManifest: boolean;

    // Logging -------------------------------------------------------------------------------------
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
    reporter: Reporter;

    /**
     * ResponseHeaders to include in error logs for debugging purposes
     * When 'all' is specified, all responseHeaders are returned
     * When 'none' is specified, no responseHeaders are returned
     * Otherwise, log any responseHeaders matches against 1...* strings/regexp
     * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
     */
    logResponseHeaders: "all" | "none" | string | RegExp | (string | RegExp)[];

    /**
     * Logging options for winston logging
     */
    log?: LoggingOptions;
  }

  // Client-level Types ----------------------------------------------------------------------------
  /**
   * The shape of Auth Token responses
   */
  interface TokenResponse {
    // Token type should always be bearer
    token_type: "bearer";
    // Scope depends on scope requested
    scope: string;
    // The auth token itself
    access_token: string;
    // Optionally, servers can specify an expiration type
    expires_in?: number;
  }

  /**
   * An object tracking the progress of a match request
   */
  interface MatchStatus {
    // When the request was started
    startedAt: number;
    // When the request was completed
    completedAt: number;
    // The time elapsed from start to the most recent response
    elapsedTime: number;
    // The percentage complete the BulkMatch is
    percentComplete: number;
    // When the next check should be done; informed by the response-headers & default wait times
    nextCheckAfter: number;
    // Information about the request
    message: string;
    // The endpoint which is being used for making status requests
    statusEndpoint: string;
    // Optional: A specified header for communicating progress information
    xProgressHeader?: string;
    // Optional: Any status-response provided retryAfter information
    retryAfterHeader?: string;
    // Optional: The body of the status-response, if any
    body?: unknown;
    // Optional: An client-created flag for ignoring status-events associated with the request completing
    virtual?: boolean;
  }

  /**
   * Information associated with a response for a Bulk-Match manifest
   */
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
     * the full URL of the original Bulk Match kick-off request
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
     * Bulk Match output files that contain OperationOutcome resources.
     */
    error: MatchManifestFile<"OperationOutcome">[];

    /**
     * To support extensions, this implementation guide reserves the name
     * extension and will never define a field with that name, allowing
     * server implementations to use it to provide custom behavior and
     * information. For example, a server may choose to provide a custom
     * extension that contains a decryption key for encrypted ndjson files.
     * The value of an extension element SHALL be a pre-coordinated JSON
     * object.
     */
    extension?: Record<string, unknown>;
  }

  /**
   * The shape of each individual file in a Bulk-Match Manifest's output or error sub-array
   */
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

    /**
     * Destination can be added if `addDestinationToManifest is set
     */
    destination?: string;
  }

  /**
   * Metadata associated with a FileDownload, stemming from files referenced in our MatchManifest
   */
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
     * - "error"   - For ndjson files with error operation outcomes
     */
    readonly exportType: "output" | "error";
  }
}

/**
 * Some helper types for JSON elements
 */
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export type JsonArray = JsonValue[];
