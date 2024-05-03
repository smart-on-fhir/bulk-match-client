"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
class TextReporter extends reporter_1.default {
    onKickOffStart(requestOptions, url) {
        console.log("Kick-off started with URL: ", url);
        console.log("Options: ", JSON.stringify(requestOptions));
    }
    onKickOffEnd() {
        console.log("Kick-off completed");
    }
    onKickOffError({ error }) {
        console.log("Kick-off failed with error: ", error.message);
    }
    onAuthorize() {
        console.log("Got new access token");
    }
    onJobStart(status) {
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }
    onJobProgress(status) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        console.log(message);
        console.log(`Job started at ${new Date(startedAt).toISOString()}, ${lib_1.Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
            `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
            `${nextCheckAfter !== -1 ? ` Will try again after ${nextCheckAfter}.` : ""}`);
    }
    onJobComplete(manifest) {
        console.log("Received manifest manifest");
        console.log(JSON.stringify(manifest));
    }
    onJobError(details) {
        console.error("There was an error in the matching process");
        console.error(JSON.stringify(details));
    }
    onDownloadStart({ fileUrl, itemType, duration, }) {
        console.log(`Begin ${itemType}-file download for ${fileUrl} at ${lib_1.Utils.formatDuration(duration)}...`);
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
