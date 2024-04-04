"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
// @ts-ignore
const package_json_1 = __importDefault(require("../../package.json"));
require("colors");
const debug = util_1.default.debuglog("bulk-match-request");
async function augmentedFetch(input, options = {}) {
    debug('in bulk-match-request');
    // Before requests: augment options to include a custom header
    if (!options.headers) {
        options.headers = {};
    }
    // @ts-ignore
    options.headers["user-agent"] = `SMART-On-FHIR Bulk Match Client / ${package_json_1.default.version}`;
    debug('options: ', JSON.stringify(options));
    return (fetch(input, options)
        // After requests – handle logging and retrying
        .then(async (response) => {
        // debug('in response')
        // const clone = response.clone();
        // debug('clone', clone)
        // debug('clone', await clone.text())
        // // debug('clone', clone.text())
        // const payload = await clone.text();
        // debug('payload', payload)
        // debug(
        //   "\n=======================================================" +
        //   "\n--------------------- Request -------------------------" +
        //   "\n%s %s\n%o\n\n%o" +
        //   "\n--------------------- Response ------------------------" +
        //   "\n%s %s\n%o\n\n%o" +
        //   "\n=======================================================",
        //   options.method,
        //   input,
        //   options.headers,
        //   payload ?? "",
        //   clone.status,
        //   clone.statusText,
        //   clone.headers,
        //   payload ?? ""
        // );
        // // Handle transient errors by asking the user if (s)he wants to
        // // retry. Note that this only happens if the "reporter" option
        // // is "cli", which implies interactive capabilities. If the
        // // reporter is "text", then there may be no way to render a
        // // question prompt so transient errors should be handled
        // // downstream by the postprocessing components
        // if (
        //   options?.context?.interactive &&
        //   payload &&
        //   clone.headers.get("Content-Type") === "application/json"
        // ) {
        //   // @ts-ignore OperationOutcome errors
        //   // Parse the payload from above into JSON
        //   const oo = JSON.parse(payload) as fhir4.OperationOutcome;
        //   if (oo.resourceType === "OperationOutcome") {
        //     if (oo.issue.every((i) => i.code === "transient")) {
        //       let msg = oo.issue
        //         .map((i) => i.details?.text || i.diagnostics)
        //         .filter(Boolean);
        //       print.commit();
        //       console.log(
        //         "The server replied with transient error(s)".red.bold
        //       );
        //       if (msg) {
        //         console.log("- " + msg.join("\n- "));
        //       }
        //       const answer =
        //         process.env.AUTO_RETRY_TRANSIENT_ERRORS ||
        //         prompt()("Would you like to retry? [Y/n]".cyan);
        //       if (!answer || answer.toLowerCase() === "y") {
        //         return augmentedFetch(input, options);
        //       } else {
        //         print("Cancelled by user");
        //         process.exit(0)
        //       }
        //     }
        //   }
        // }
        debug('about to return response');
        return response;
    })
        .catch((e) => {
        debug('FAILED fetch: ', e.message);
        console.error(e);
        throw e;
    }));
}
exports.default = augmentedFetch;
