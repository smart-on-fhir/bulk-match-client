"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/ban-ts-comment */
require("colors");
const prompt_sync_1 = __importDefault(require("prompt-sync"));
const util_1 = __importDefault(require("util"));
const package_json_1 = __importDefault(require("../../package.json"));
const utils_1 = require("./utils");
const debug = util_1.default.debuglog("bulk-match-request");
async function augmentedFetch(input, options = {}) {
    // Before requests: augment options to include a custom header
    if (!options.headers) {
        options.headers = {};
    }
    // @ts-ignore
    options.headers["user-agent"] =
        `SMART-On-FHIR Bulk Match Client / ${package_json_1.default.version}`;
    //@ts-ignore
    return (fetch(input, options)
        // After requests – handle logging and retrying
        .then(async (response) => {
        let body = await response.text();
        const contentType = response.headers.get("content-type") || "";
        if (body.length && contentType.match(/\bjson\b/i)) {
            body = JSON.parse(body);
        }
        if (!response.ok) {
            // @ts-ignore
            throw new Error(body?.message || body || response.statusText);
        }
        debug("\n=======================================================" +
            "\n--------------------- Request -------------------------" +
            "\n%s %s" +
            "\nHeaders: %o" +
            "\n\nBody: %o" +
            "\n--------------------- Response ------------------------" +
            "\n%s %s" +
            "\nHeaders: %o" +
            "\n\nBody: %o" +
            "\n=======================================================", 
        // REQUEST
        options.method || "GET", input, options.headers, options.body ?? "", 
        // RESPONSE
        response.status, response.statusText, Object.fromEntries(response.headers), body ?? "");
        // Handle transient errors by asking the user if (s)he wants to
        // retry. Note that this only happens if the "reporter" option
        // is "cli", which implies interactive capabilities. If the
        // reporter is "text", then there may be no way to render a
        // question prompt so transient errors should be handled
        // downstream by the postprocessing components
        if (options?.context?.interactive &&
            body &&
            response.headers.get("Content-Type") === "application/json") {
            // @ts-ignore OperationOutcome errors
            // Parse the body from above into JSON
            const oo = JSON.parse(body);
            if (oo.resourceType === "OperationOutcome") {
                if (oo.issue.every((i) => i.code === "transient")) {
                    const msg = oo.issue
                        .map((i) => i.details?.text || i.diagnostics)
                        .filter(Boolean);
                    utils_1.print.commit();
                    console.log("The server replied with transient error(s)".red.bold);
                    if (msg) {
                        console.log("- " + msg.join("\n- "));
                    }
                    const answer = process.env.AUTO_RETRY_TRANSIENT_ERRORS ||
                        (0, prompt_sync_1.default)()("Would you like to retry? [Y/n]".cyan);
                    if (!answer || answer.toLowerCase() === "y") {
                        return augmentedFetch(input, options);
                    }
                    else {
                        (0, utils_1.print)("Cancelled by user");
                        process.exit(0);
                    }
                }
            }
        }
        return {
            response,
            body: body,
        };
    })
        .catch((e) => {
        debug("FAILED fetch: ", e.message);
        console.error(e);
        throw e;
    }));
}
exports.default = augmentedFetch;
