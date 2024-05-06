"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
const debug = (0, util_1.debuglog)("bulk-match-text-reporter");
class TextReporter extends reporter_1.default {
    onKickOffStart(requestOptions, url) {
        console.log("Kick-off started with URL: ", url);
        debug("Options: " + JSON.stringify(requestOptions));
    }
    onKickOffEnd() {
        console.log("Kick-off completed");
    }
    onKickOffError({ error }) {
        console.log("Kick-off failed with error: ", error.message);
    }
    onAuthorize() {
        console.log("Authorized");
    }
    onJobStart(status) {
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }
    onJobProgress(status) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        console.log(message);
        debug(`Job started at ${new Date(startedAt).toISOString()}, ${lib_1.Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
            `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
            `${nextCheckAfter !== -1 ? ` Will try again after ${lib_1.Utils.formatDuration(nextCheckAfter)}.` : ""}`);
    }
    onJobComplete(manifest) {
        console.log("Received manifest manifest");
        debug(JSON.stringify(manifest));
    }
    onJobError(details) {
        console.error("There was an error in the matching process");
        console.error(JSON.stringify(details));
    }
    onDownloadStart({ fileUrl, itemType, startTime, }) {
        console.log(`Begin ${itemType}-file download for ${fileUrl} at ${lib_1.Utils.formatDuration(startTime)}...`);
    }
    onDownloadComplete({ fileUrl, duration }) {
        console.log(`${fileUrl} download completed in ${lib_1.Utils.formatDuration(duration)}`);
    }
    onDownloadError({ fileUrl, message, duration, }) {
        console.log(`${fileUrl} download FAILED in ${lib_1.Utils.formatDuration(duration)}`);
        console.log("Message: " + message);
    }
    onAllDownloadsComplete(_, duration) {
        console.log(`All downloads completed in ${lib_1.Utils.formatDuration(duration)}`);
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = TextReporter;
