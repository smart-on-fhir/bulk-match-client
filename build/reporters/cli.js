"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("colors");
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
class CLIReporter extends reporter_1.default {
    constructor() {
        super(...arguments);
        this.downloadStart = 0;
    }
    onKickOffStart(requestOptions, url) {
        lib_1.Utils.print("Kick-off started with URL: " + url).commit();
        lib_1.Utils.print("Options: " + JSON.stringify(requestOptions)).commit();
    }
    onKickOffEnd() {
        lib_1.Utils.print("Kick-off completed").commit();
    }
    onKickOffError(error) {
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
        lib_1.Utils.print(`Job started at ${startedAt}, ${elapsedTime} time has elapsed and job is ${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}. Will try again after ${nextCheckAfter}`).commit();
    }
    onJobComplete(manifest) {
        lib_1.Utils.print("Received manifest manifest").commit();
        lib_1.Utils.print(JSON.stringify(manifest)).commit();
    }
    onJobError(details) {
        lib_1.Utils.print("There was an error in the matching process").commit();
        lib_1.Utils.print(JSON.stringify(details)).commit();
    }
    onDownloadStart() {
        if (!this.downloadStart)
            this.downloadStart = Date.now();
    }
    onDownloadComplete() {
        console.log(`Download completed in ${lib_1.Utils.formatDuration(Date.now() - this.downloadStart)}`);
        // Reset to 0
        this.downloadStart = 0;
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = CLIReporter;
