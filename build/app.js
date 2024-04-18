"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("colors");
const commander_1 = require("commander");
const node_jose_1 = __importDefault(require("node-jose"));
const path_1 = require("path");
const prompt_sync_1 = __importDefault(require("prompt-sync"));
const util_1 = __importDefault(require("util"));
const BulkMatchClient_1 = __importDefault(require("./client/BulkMatchClient"));
const lib_1 = require("./lib");
const logger_1 = require("./logger");
const reporters_1 = require("./reporters");
const Reporters = {
    cli: reporters_1.CLIReporter,
    text: reporters_1.TextReporter,
};
const debug = util_1.default.debuglog("bulk-match-app");
const APP = new commander_1.Command();
APP.name("node .");
APP.version("2.0.0");
// Bulk Data Server base URL
APP.option("--config <path>", "Relative path to config file.");
APP.option("-f, --fhir-url [url]", "FHIR server base URL. Must be set either as parameter or in the configuration file.");
APP.option("-r, --resource [resource/filepath]", "The resources to find matches for; can be either an inline FHIR resource, a path to a FHIR JSON file, or a path to an NDJSON resource file");
APP.option("-s, --onlySingleMatch", "If there are multiple potential matches, the server should identify the single most appropriate match that should be used with future interactions with the server; defaults to false");
APP.option("-C, --onlyCertainMatches", "If there are multiple potential matches, the server should be certain that each of the records are for the same patient. This could happen if the records are duplicates, are the same person for the purpose of data segregation, or other reasons; defaults to false");
APP.option("-c, --count [number]", "The maximum number of records to return per resource. If no value is provided, the server may decide how many matches to return. Note that clients should be careful when using this, as it may prevent probable - and valid - matches from being returned.");
APP.option("-F, --_outputFormat [string]", `The output format you expect.`);
APP.option("-d, --destination [destination]", "Download destination. See config/defaults.js for examples");
APP.option("--reporter [cli|text]", 'Reporter to use to render the output. "cli" renders fancy progress bars and tables. "text" is better for log files. Defaults to "cli".');
// APP.option("-c, --custom [opt=val...]"         , "Custom parameters to be passed to the kick-off endpoint.");
APP.option("--status [url]", "Status endpoint of already started export.");
APP.action(async (args) => {
    const { config, ...params } = args;
    const defaultsPath = (0, path_1.resolve)(__dirname, "../config/defaults.js");
    const base = await Promise.resolve(`${defaultsPath}`).then(s => __importStar(require(s)));
    // Options will be a combination of Normalized Options and CLI Options
    const options = {
        ...base,
    };
    if (config) {
        const configPath = (0, path_1.resolve)(__dirname, "..", config);
        const cfg = await Promise.resolve(`${configPath}`).then(s => __importStar(require(s)));
        Object.assign(options, cfg);
    }
    Object.assign(options, params);
    // Verify fhirUrl ----------------------------------------------------------
    if (!options.fhirUrl) {
        console.log("A 'fhirUrl' is required as configuration option, or as '-f' or " +
            "'--fhir-url' parameter!".red);
        return APP.help();
    }
    options.fhirUrl = options.fhirUrl.replace(/\/*$/, "/");
    // Verify tokenUrl ---------------------------------------------------------
    if (!options.tokenUrl) {
        try {
            options.tokenUrl = await lib_1.Utils.detectTokenUrl(options.fhirUrl);
        }
        catch {
            console.log("Failed to auto-detect 'tokenUrl'! " +
                "Please set it in the config file".red);
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
            options.privateKey = await node_jose_1.default.JWK.asKey(options.privateKey, "json");
        }
        catch {
            console.log("Invalid 'privateKey' option in the config file!".red);
            return;
        }
    }
    options.log = {
        enabled: true,
        ...(options.log || {}),
    };
    const client = new BulkMatchClient_1.default(options);
    const reporter = new Reporters[options.reporter](client);
    if (options.log.enabled) {
        const logger = (0, logger_1.createLogger)(options.log);
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
    const statusEndpoint = options.status || (await client.kickOff());
    debug(statusEndpoint);
    const manifest = await client.waitForMatch(statusEndpoint);
    debug(JSON.stringify(manifest));
    const matches = await client.downloadAllFiles(manifest);
    debug(JSON.stringify(matches));
    if (options.reporter === "cli") {
        const answer = (0, prompt_sync_1.default)()("Do you want to signal the server that this export can be removed? [Y/n]"
            .cyan);
        if (!answer || answer.toLowerCase() === "y") {
            client
                .cancelMatch(statusEndpoint)
                .then(() => console.log("\nThe server was asked to remove this patient match !".green.bold));
        }
    }
});
async function main() {
    await APP.parseAsync(process.argv);
}
main();
