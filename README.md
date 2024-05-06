# Bulk Match Client: A CLI Application

The Bulk Match Client is an open-source command-line interface for matching FHIR Patient resources on a FHIR server based on a set of patient demographic information.

## Installation

To install and use the Bulk Match Client CLI, you need to have Node.js installed on your system. After cloning the project onto your machine, you can run the CLI using `node .`:

```bash
# Installing the relevant dependencies to run the CLI
npm install

# Running the CLI directly from within the project directory
node . [options]
node . --config config/my-config.json -f https://bulk-match-provider-df228d68a43b.herokuapp.com/fhir/ --resource data/patients-to-match.ndjson
```

## Options

There are many options for configuring the `bulk-match-client` to your usecase, and two ways of specifying those options

1. Create new configuration files by duplicating our default config in `config/defaults.js` and specifying arguments there.
2. Providing them as CLI arguments, which will override the values specified in the config-file

### Config File Options

The Bulk Match Client uses `js` configuration files, but you can think of them as JSON configuration objects. The only reason to use JS is to allow for comments and type hinting. Below are all the options that can be set in a configuration file.

Auth and FHIR Server Options:

-   _string_ **`fhirUrl`** - FHIR server base URL. Can be overridden by the `-f` or `--fhir-url` CLI parameter.
-   _string_ **`tokenUrl`** - The Bulk Data server token URL (use `"none"` for open servers and `""` to try to auto-detect it)
-   _object_ **`privateKey`** - The private key (as `JWK`) used to sign authentication tokens. This is not needed for open servers
-   _string_ **`clientId`** - This is not needed for open servers, but identifies the client when making requests. Important for auth servers
-   _number_ **`accessTokenLifetime`** - The access token lifetime in seconds. Note that the authentication server may ignore or restrict this to its own boundaries

Bulk Match Parameter Options:

-   _string_ **`resource`** - The patients to match; can be inline FHIR resources, a path to a FHIR JSON, a path to an NDJSON file, or a path to a directory containing FHIR JSON. Can be overridden using CLI parameter `-r` or `--resource`.
-   _boolean_ **`onlySingleMatch`** - If there are multiple potential matches, the server should only return the single most appropriate match; defaults to `false`. Can be overridden using CLI flag `-s` or `--onlySingleMatch`
-   _boolean_ **`onlyCertainMatches`** - If there are multiple potential matches, the server should be certain that each of the records are for the same patient. defaults to `false`. Can be overridden using CLI flag `-C` or `--onlyCertainMatches`
-   _number_ **`count`** - Specifies the maximum number of records to return per resource. If no value is provided, the server may decide how many matches to return. Can be overridden using CLI parameter `-c` or `--count`
-   _string_ **`_outputFormat`** - The value of the `_outputFormat` parameter for Bulk Data kick-off requests. Will be ignored if empty or falsy. Can be overridden from terminal parameter `-F` or `--_outputFormat`

Download related options:

-   _string_ **`destination`**: Where to save the patient matches. Can be overridden from terminal parameter `-d` or `--destination`. Examples:
    -   `./downloads` - Save to local folder (relative to the config file)
    -   `downloads` - Save to local folder (relative to the config file)
    -   `/path/to/downloads` - Save to local folder (absolute path)
    -   `file:///path/to/downloads` - Save to local folder (file url)
    -   `""` - do nothing
    -   `"none"` - do nothing
    -   `"> /dev/null"` - do nothing
-   _boolean_ **`saveManifest`** - In some cases it might be useful to also save the export manifest file along with the downloaded NDJSON files.
-   _boolean_ **`addDestinationToManifest`** - The original export manifest will have an `url` property for each file, containing the source location. It his is set to `true`, add a `destination` property to each file containing the path (relative to the manifest file) to the saved file. This is ONLY used if `saveManifest` is set to `true`.

Logging related options:

-   _string_ **`reporter`** - The default reporter is "cli". However, this format can look bloated when your STDOUT ends up in log files. For example, if you are using this tool as part of some kind of pipeline and want to maintain clean logs, then consider changing this to "text". Can be overridden from terminal parameter `--reporter`.
-   _object_ **`log`** - Optional logging options (see below):
    -   _boolean_ **`log.enabled`** - Set this to false to disable logging. Optional (defaults to true).
    -   _string_ **`log.file`** - Path to the log file. Absolute, or relative to process CWD. If not provided, the file will be called log.ndjson and will be stored in the downloads folder.
    -   _object_ **`log.metadata`** - Key/value pairs to be added to every log entry. Can be used to add useful information (for example which site imported this data).
-   _complex_ **`logResponseHeaders`** - ResponseHeaders to include in error logs for debugging purposes.
    -   As for the complex type, valid values are `"all" | "none" | string | RegExp | (string | RegExp)[]`
    -   When `"all"` is specified, all responseHeaders are returned. When `"none"` is specified, no responseHeaders are returned. Otherwise, log any responseHeaders matches against 1...\* strings/regexp

Options relating to HTTP requests:

-   _number_ **`retryAfterMSec`** - If the server does not provide `Retry-after` header use this number of milliseconds before checking the status again.
-   _object_ **`requests`** - Custom options for every request. Many options are available so be careful what you specify here! See [https://developer.mozilla.org/en-US/docs/Web/API/Fetch#options](https://developer.mozilla.org/en-US/docs/Web/API/Fetch#options). Example:
    ```js
    requests: {
        headers: {
            "x-client-id": "whatever" // pass custom headers
        }
    }
    ```
-   _boolean_ **`autoRetryOnTransientError`** - Should requests be automatically retried when server's respond with Transient errors. Defaults to `false`, in which case users will be prompted before retrying.

### CLI Parameters

Note that you can pass a `--help` parameter with the CLI to see this listed in your terminal.

| short | long                             | description                                                                                                                                                                     |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|       | `--config [config]`              | Relative path to config file. These options are merged with those defined in `config/default.js`                                                                                |
| `-f`  | `--fhir-url [url]`               | FHIR server base URL. Must be set either as parameter or in the configuration file                                                                                              |
| `-r`  | `--resource [resource/filepath]` | The patients to match; can be inline FHIR resources, a path to a FHIR JSON, a path to an NDJSON file, or a path to a directory containing FHIR JSON                             |
| `-s`  | `--onlySingleMatch`              | If there are multiple potential matches, the server should only return the single most appropriate match; defaults to `false`                                                   |
| `-C`  | `--onlyCertainMatches`           | If there are multiple potential matches, the server should be certain that each of the records are for the same patient. defaults to `false`                                    |
| `-c`  | `--count [number]`               | Specifies the maximum number of records to return per resource. If no value is provided, the server may decide how many matches to return                                       |
| `-F`  | `--_outputFormat [file-format]`  | The output format you expect back from the server                                                                                                                               |
| `-d`  | `--destination [destination]`    | Specifies the download destination. See `config/defaults.js` for examples                                                                                                       |
|       | `--reporter [reporterType]`      | Reporter to use to render the output. `cli` renders fancy progress bars and tables. `text` is better for log files. Defaults to `cli`                                           |
|       | `--status  [url]`                | If a status request fails for some reason the client will exit. However, if the status endpoint is printed in the output, you can retry by passing it as `--status` option here |

### Environment Variables

There are two environment that can be passed to the client to modify it's logging behavior:

-   `NODE_DEBUG` - By setting this to "bulk-\*", you will see all verbose debug-friendly logging that's be written across the app. This is (unsurprisingly) helpful when debugging. Additionally, you can increase the specificity of the ENV variable here to drill in on logs for a specific part of the app. To see what kinds of options are available, run a global find across the project searching for `debuglog("bulk-`.
-   `ALL_TEST_OUTPUT` - When running tests, some tests are performed by spawning a child process and running the client through that process (the helper responsible for this is the `invoke` method). Because this is a spawn-process, by default the output of that process is piped elsewhere. To align the child-process' output with the main-process' output pipes, set this variable to `true` or any other value.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](https://github.com/smart-on-fhir/bulk-match-client/blob/main/LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/smart-on-fhir/bulk-match-client/issues) on GitHub.
