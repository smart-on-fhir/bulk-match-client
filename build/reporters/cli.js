"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("colors");
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
class CLIReporter extends reporter_1.default {
    onKickOffStart(requestOptions, url) {
        lib_1.Utils.print("Kick-off started with URL: " + url).commit();
        lib_1.Utils.print("Options: " + JSON.stringify(requestOptions)).commit();
    }
    onKickOffEnd() {
        lib_1.Utils.print("Kick-off completed").commit();
    }
    onKickOffError({ error }) {
        lib_1.Utils.print("Kick-off failed with error: " + error.message).commit();
    }
    onAuthorize() {
        lib_1.Utils.print("Got new access token").commit();
    }
    onJobStart(status) {
        lib_1.Utils.print(status.message).commit();
        lib_1.Utils.print(`Status endpoint: ${status.statusEndpoint}`).commit();
    }
    onJobProgress(status) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        lib_1.Utils.print(message).commit();
        lib_1.Utils.print(`Job started at ${new Date(startedAt).toISOString()}, ${lib_1.Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
            `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
            `${nextCheckAfter !== -1 ? ` Will try again after ${lib_1.Utils.formatDuration(nextCheckAfter)}.` : ""}`).commit();
    }
    onJobComplete(manifest) {
        lib_1.Utils.print("Received manifest manifest").commit();
        lib_1.Utils.print(JSON.stringify(manifest)).commit();
    }
    onJobError(details) {
        lib_1.Utils.print("There was an error in the matching process").commit();
        lib_1.Utils.print(JSON.stringify(details)).commit();
    }
    onDownloadStart({ fileUrl, itemType, duration, }) {
        lib_1.Utils.print(`Begin ${itemType}-file download for ${fileUrl} at ${lib_1.Utils.formatDuration(duration)}...`).commit();
    }
    onDownloadComplete({ fileUrl, duration }) {
        lib_1.Utils.print(`${fileUrl} download complete in ${lib_1.Utils.formatDuration(duration)}`).commit();
    }
    onDownloadError({ fileUrl, message, duration, }) {
        lib_1.Utils.print(`${fileUrl} download failed in ${lib_1.Utils.formatDuration(duration)}`).commit();
        lib_1.Utils.print("Message: " + message).commit();
    }
    onAllDownloadsComplete(_, duration) {
        lib_1.Utils.print(`Download completed in ${lib_1.Utils.formatDuration(duration)}`).commit();
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = CLIReporter;
