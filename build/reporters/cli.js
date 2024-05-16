"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("colors");
const util_1 = require("util");
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
const debug = (0, util_1.debuglog)("bulk-match-cli-reporter");
class CLIReporter extends reporter_1.default {
    onKickOffStart(requestOptions, url) {
        lib_1.Utils.print("Kick-off started with URL: " + url).commit();
        debug("Options: " + JSON.stringify(requestOptions));
    }
    onKickOffEnd() {
        lib_1.Utils.print("Kick-off completed").commit();
    }
    onKickOffError({ error }) {
        lib_1.Utils.print("Kick-off failed with error: " + error.message).commit();
    }
    onAuthorize() {
        lib_1.Utils.print("Authorized").commit();
    }
    onJobStart(status) {
        lib_1.Utils.print(`${status.message}, using status endpoint ${status.statusEndpoint}`).commit();
    }
    onJobProgress(status) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        lib_1.Utils.print(message);
        debug(`Job started at ${lib_1.Utils.formatDatetimeTimestamp(startedAt)}, ${lib_1.Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
            `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
            `${nextCheckAfter !== -1 ? ` Will try again after ${lib_1.Utils.formatDuration(nextCheckAfter)}.` : ""}`);
    }
    onJobComplete(manifest) {
        lib_1.Utils.print.commit();
        lib_1.Utils.print("Received manifest manifest").commit();
        debug(JSON.stringify(manifest));
    }
    onJobError(details) {
        lib_1.Utils.print("There was an error in the matching process: " + JSON.stringify(details)).commit();
    }
    onDownloadStart({ fileUrl, itemType, startTime, }) {
        lib_1.Utils.print(`Begin ${itemType === "error" ? "error-file " : " "}download for ${fileUrl} at ${lib_1.Utils.formatDatetimeTimestamp(startTime)}...`).commit();
    }
    onDownloadComplete({ fileUrl, duration }) {
        lib_1.Utils.print(`${fileUrl} download complete in ${duration}`).commit();
    }
    onDownloadError({ fileUrl, message, duration, responseHeaders, }) {
        lib_1.Utils.print(`${fileUrl} download failed in ${duration}. Message: ${message}`).commit();
        if (responseHeaders)
            debug("responseHeaders: ", JSON.stringify(responseHeaders));
    }
    onAllDownloadsComplete(_, duration) {
        lib_1.Utils.print(`All downloads completed in ${duration}`).commit();
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = CLIReporter;
