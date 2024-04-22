import "colors";
import { Command } from "commander";
import jose from "node-jose";
import { resolve } from "path";
import prompt from "prompt-sync";
import util from "util";
import { BulkMatchClient as Types } from "..";
import Client from "./client/BulkMatchClient";
import { Utils } from "./lib";
import { createLogger } from "./logger";
import { CLIReporter, TextReporter } from "./reporters";

const Reporters = {
  cli: CLIReporter,
  text: TextReporter,
};

const debug = util.debuglog("bulk-match-app");

const APP = new Command();

APP.name("node .");

APP.version("2.0.0");

// Bulk Data Server base URL
APP.option("--config <path>", "Relative path to config file.");
APP.option(
  "-f, --fhir-url [url]",
  "FHIR server base URL. Must be set either as parameter or in the configuration file.",
);
APP.option(
  "-r, --resource [resource/filepath]",
  "The resources to find matches for; can be either an inline FHIR resource, a path to a FHIR JSON file, or a path to an NDJSON resource file",
);
APP.option(
  "-s, --onlySingleMatch",
  "If there are multiple potential matches, the server should identify the single most appropriate match that should be used with future interactions with the server; defaults to false",
);
APP.option(
  "-C, --onlyCertainMatches",
  "If there are multiple potential matches, the server should be certain that each of the records are for the same patient. This could happen if the records are duplicates, are the same person for the purpose of data segregation, or other reasons; defaults to false",
);
APP.option(
  "-c, --count [number]",
  "The maximum number of records to return per resource. If no value is provided, the server may decide how many matches to return. Note that clients should be careful when using this, as it may prevent probable - and valid - matches from being returned.",
);
APP.option("-F, --_outputFormat [string]", `The output format you expect.`);
APP.option(
  "-d, --destination [destination]",
  "Download destination. See config/defaults.js for examples",
);
APP.option(
  "--reporter [cli|text]",
  'Reporter to use to render the output. "cli" renders fancy progress bars and tables. "text" is better for log files. Defaults to "cli".',
);
// APP.option("-c, --custom [opt=val...]"         , "Custom parameters to be passed to the kick-off endpoint.");
APP.option("--status [url]", "Status endpoint of already started export.");

APP.action(async (args: Types.CLIOptions) => {
  const { config, ...params } = args;
  const defaultsPath = resolve(__dirname, "../config/defaults.js");

  const base: Types.NormalizedOptions = await import(defaultsPath);
  // Options will be a combination of Normalized Options and CLI Options, building up from the default config
  const options: Partial<Types.NormalizedOptions & Types.CLIOptions> = {
    ...base,
  };

  //
  if (config) {
    const configPath = resolve(__dirname, "..", config);
    const cfg: Types.ConfigFileOptions = await import(configPath);
    Object.assign(options, cfg);
  }
  Object.assign(options, params);

  // Verify fhirUrl ----------------------------------------------------------
  if (!options.fhirUrl) {
    console.log(
      "A 'fhirUrl' is required as configuration option, or as '-f' or " +
        "'--fhir-url' parameter!".red,
    );
    return APP.help();
  }
  options.fhirUrl = options.fhirUrl.replace(/\/*$/, "/");

  // Verify tokenUrl ---------------------------------------------------------
  if (!options.tokenUrl) {
    try {
      options.tokenUrl = await Utils.detectTokenUrl(options.fhirUrl);
    } catch {
      console.log(
        "Failed to auto-detect 'tokenUrl'! " +
          "Please set it in the config file".red,
      );
      return;
    }
  }

  // Verify privateKey -------------------------------------------------------
  if (options.tokenUrl !== "none") {
    if (!options.privateKey) {
      console.log("A 'privateKey' option must be set in the config file!".red);
      return;
    }

    try {
      options.privateKey = await jose.JWK.asKey(options.privateKey, "json");
    } catch {
      console.log("Invalid 'privateKey' option in the config file!".red);
      return;
    }
  }

  options.log = {
    enabled: true,
    ...(options.log || {}),
  };

  const client = new Client(options as Types.NormalizedOptions);
  const reporter = new Reporters[(options as Types.NormalizedOptions).reporter](
    client,
  );

  if (options.log.enabled) {
    const logger = createLogger(options.log);
    client.addLogger(logger);
  }

  process.on("SIGINT", () => {
    console.log("\nExport canceled.".magenta.bold);
    reporter.detach();
    client.abort();
    // Should this cancel the export on the server?
    process.exit(0);
  });

  process.on("uncaughtException", (e) => {
    console.error(e);
    process.exit(1);
  });

  client.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  const statusEndpoint =
    (options as Types.CLIOptions).status || (await client.kickOff());
  debug("Match request started, checking in at the following endpoint");
  debug(statusEndpoint);
  const manifest = await client.waitForMatch(statusEndpoint);
  debug("Match completed - resulting in the following manifest");
  debug(JSON.stringify(manifest));
  const matches = await client.downloadAllFiles(manifest);
  debug("Matches downloaded for the following:");
  debug(JSON.stringify(matches));

  if (options.reporter === "cli") {
    const answer = prompt()(
      "Do you want to signal the server that this export can be removed? [Y/n]"
        .cyan,
    );
    if (!answer || answer.toLowerCase() === "y") {
      client
        .cancelMatch(statusEndpoint)
        .then(() =>
          console.log(
            "\nThe server was asked to remove this patient match !".green.bold,
          ),
        );
    }
  }
});

async function main() {
  await APP.parseAsync(process.argv);
}

main();
