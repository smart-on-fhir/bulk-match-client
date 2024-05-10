"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file lists default values for all the available options and their descriptions.
 * @type {BulkMatchClient.ConfigFileOptions}
 */
exports.default = {
    // Server Configuration and Auth configuration -------------------------------------------------
    /**
     * FHIR server base URL. Can be overridden by the `-f` or `--fhir-url`
     * CLI parameter.
     */
    fhirUrl: "",
    /**
     * The Bulk Match server token URL ("none" or "" for open servers; "auto" to auto-detect it)
     */
    tokenUrl: "none",
    /**
     * The private key (JWK) used to sign authentication tokens. This is not
     * needed for open servers
     */
    privateKey: undefined,
    /**
     * This is not needed for open servers
     */
    clientId: "",
    /**
     * The scope to use in the authorization request. If not set, defaults to
     * "system/Patient.rs"
     */
    scope: "system/Patient.rs",
    /**
     * The access token lifetime in seconds. Note that the authentication server
     * may ignore or restrict this to its own boundaries
     */
    accessTokenLifetime: 300,
    // Customizing the Match request ---------------------------------------------------------------
    /**
     * The FHIR resource(s) to match, processed into the `resource` parameter(s) for Bulk Match kick-off
     * Can take the following forms
     *    - "/User/absolute/path/to/dir/containing/json"
     *    - "./relative/absolute/path/to/dir/containing/json"
     *    - "/User/absolute/path/to/fhir.json"
     *    - "./relative/absolute/path/to/fhir.json"
     *    - "/User/absolute/path/to/fhir.ndjson"
     *    - "./relative/absolute/path/to/fhir.ndjson"
     *    - "{"resourceType": "Patient"}" A string representation of the resource
     *    - {"resourceType": "Patient"} An inline object representing the resource
     *    - [{"resourceType": "Patient", "id": 1}, {"resourceType": "Patient", "id": 2}] An inline array
     *      of resources to match
     *
     * Can be overridden from terminal parameter `-r` or `--resource`
     */
    resource: [],
    /**
     * The value of the `_outputFormat` parameter for Bulk Match kick-off
     * requests. Will be ignored if empty or falsy.
     *
     * Can be overridden from terminal parameter `-F` or `--_outputFormat`
     */
    _outputFormat: undefined,
    /**
     * The value of the `onlySingleMatch` parameter for Bulk Match kick-off
     * requests. Should the server respond only with a single match?
     *
     * Can be overridden from terminal parameter `-s` or `--onlySingleMatch`
     */
    onlySingleMatch: false,
    /**
     * The value of the `onlyCertainMatches` parameter for Bulk Match kick-off
     * requests. Should the server only respond with certain matches?
     *
     * Can be overridden from terminal parameter `-C` or `--onlyCertainMatches`
     */
    onlyCertainMatches: false,
    /**
     * The value of the `count` parameter for Bulk Match kick-off
     * requests. The maximum number of records to return per resource.
     * Will be ignored if empty or falsy.
     *
     * Can be overridden from terminal parameter `-c` or `--count`
     */
    count: undefined,
    // Customizing the request logic ---------------------------------------------------------------
    /**
     * Custom options for every request, EXCLUDING the authorization request and
     * any upload requests (in case we use remote destination).
     * @type {RequestInit}
     */
    requests: {},
    /**
     * If the server does not provide `Retry-after` header use this number of
     * milliseconds before checking the status again
     */
    retryAfterMSec: 200,
    /**
     * Auto-retry on transient errors
     */
    autoRetryOnTransientError: false,
    // Destination options -------------------------------------------------------------------------
    /**
     * The original match manifest will have an `url` property for each
     * file, containing the source location. If this is set to `true`, add
     * a `destination` property to each file containing the path (relative
     * to the manifest file) to the saved file.
     *
     * This is ONLY useful if `saveManifest` is set to `true`.
     *
     * **Defaults to `false`**
     */
    addDestinationToManifest: false,
    /**
     * Examples:
     * - `./downloads` - Save to local folder (relative to the config file)
     * - `downloads` - Save to local folder (relative to the config file)
     * - `/path/to/downloads` - Save to local folder (absolute path)
     * - `""` - do nothing
     * - `"none"` - do nothing
     *
     * Can be overridden from terminal parameter `-d` or `--destination`
     */
    destination: "./downloads",
    /**
     * In some cases it might be useful to also save the match manifest
     * file along with the downloaded NDJSON files.
     */
    saveManifest: true,
    // Logging options -----------------------------------------------------------------------------
    /**
     * Logging options for winston logging
     */
    log: {
        enabled: true,
        /**
         * Key/value pairs to be added to every log entry. Can be used to add
         * useful information, for example which site imported this data.
         */
        metadata: {
        // siteId: "localhost"
        },
    },
    /**
     * ResponseHeaders to include in error logs for debugging purposes
     * When 'all' is specified, all responseHeaders are returned
     * When 'none' is specified, no responseHeaders are returned
     * Otherwise, log any responseHeaders matches against 1...* strings/regexp
     * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
     */
    logResponseHeaders: "all",
    /**
     * The default reporter is "cli". That works well in terminal and
     * renders some fancy stuff like progress bars. However, this does not
     * look good when your STDOUT ends up in log files. For example, if
     * you are using this tool as part of some kind of pipeline and want to
     * maintain clean logs, then consider changing this to "text".
     *
     * Can be overridden from terminal parameter `--reporter`.
     */
    reporter: "cli",
};
