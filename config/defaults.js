/**
 * This file lists all the available options and their descriptions and default
 * values.
 *
 * USE THIS AS A TEMPLATE FOR CREATING YOU OWN CONFIGURATION FILES THAT ONLY
 * OVERRIDE THE PROPERTIES YOU NEED TO CHANGE. Then use the `--config` parameter
 * in CLI to load your configuration file.
 *
 * @type {import("..").BulkMatchClient.ConfigFileOptions}
 */
module.exports = {
  /**
   * FHIR server base URL. Can be overridden by the `-f` or `--fhir-url`
   * CLI parameter.
   */
  fhirUrl: "",

  /**
   * The Bulk Data server token URL ("none" for open servers)
   */
  tokenUrl: "none",

  /**
   * The private key (JWK) used to sign authentication tokens. This is not
   * needed for open servers
   */
  privateKey: {},

  /**
   * This is not needed for open servers
   */
  clientId: "",

  /**
   * The scope to use in the authorization request. If not set, defaults to
   * "system/*.read"
   */
  scope: "system/*.read",

  /**
   * The access token lifetime in seconds. Note that the authentication server
   * may ignore or restrict this to its own boundaries
   */
  accessTokenLifetime: 300,

  resource: "{}",
  // _outputFormat: "application/fhir+ndjson",
  // onlySingleMatch: true,
  // onlyCertainMatches: true,
  // count: 3,

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

  /**
   * The value of the `_outputFormat` parameter for Bulk Data kick-off
   * requests. Will be ignored if empty or falsy.
   *
   * Can be overridden from terminal parameter `-F` or `--_outputFormat`
   */
  _outputFormat: "",

  /**
   * The value of the `includeAssociatedData` parameter for Bulk Data kick-off
   * requests. Will be ignored if empty or falsy.
   *
   * Can be overridden from terminal parameter `-i` or `--includeAssociatedData`
   */
  includeAssociatedData: "",

  /**
   * If true, adds `handling=lenient` to the `prefer` request header. This may
   * enable a "retry" option after certain errors. It can also be used to
   * signal the server to silently ignore unsupported parameters.
   *
   * Can be overridden from terminal parameter `--lenient`
   */
  lenient: true,

  /**
   * Custom options for every request, EXCLUDING the authorization request and
   * any upload requests (in case we use remote destination).
   * @type {RequestInit}
   */
  requests: {},

  /**
   * How many downloads to run in parallel. This will speed up the
   * download but can also overload the server. Don't be too greedy and
   * don't set this to more than 10!
   */
  parallelDownloads: 5,

  /**
   * In some cases it might be useful to also save the export manifest
   * file along with the downloaded NDJSON files.
   */
  saveManifest: false,

  /**
   * While parsing NDJSON files every single (non-empty) line is parsed
   * as JSON. It is recommended to set a reasonable limit for the line
   * length so that a huge line does not consume the entire memory.
   */
  ndjsonMaxLineLength: 10000000,

  /**
   * If the server reports the file `count` in the export manifest,
   * verify that the number of resources found in the file matches the
   * count reported by the server.
   */
  ndjsonValidateFHIRResourceCount: true,

  /**
   * The original export manifest will have an `url` property for each
   * file, containing the source location. It his is set to `true`, add
   * a `destination` property to each file containing the path (relative
   * to the manifest file) to the saved file.
   *
   * This is ONLY used if `saveManifest` is set to `true`.
   */
  addDestinationToManifest: false,

  /**
   * Examples:
   * - `./downloads` - Save to local folder (relative to the config file)
   * - `downloads` - Save to local folder (relative to the config file)
   * - `/path/to/downloads` - Save to local folder (absolute path)
   * - `file:///path/to/downloads` - Save to local folder (file url)
   * - `http://destination.dev` - POST to http
   * - `http://username:password@destination.dev` - POST to http with basic auth
   * - `""` - do nothing
   * - `"none"` - do nothing
   *
   * Can be overridden from terminal parameter `-d` or `--destination`
   */
  destination: "./downloads",

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
   * If the server does not provide `Retry-after` header use this number of
   * milliseconds before checking the status again
   */
  retryAfterMSec: 200,

  /**
   * ResponseHeaders to include in error logs for debugging purposes
   * When 'all' is specified, all responseHeaders are returned
   * When 'none' is specified, no responseHeaders are returned
   * Otherwise, log any responseHeaders matches against 1...* strings/regexp
   * NOTE: When an empty array is specified, an empty object of responseHeaders will be returned
   */
  logResponseHeaders: "all",
};
