"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("../lib");
const reporter_1 = __importDefault(require("./reporter"));
class TextReporter extends reporter_1.default {
    constructor() {
        super(...arguments);
        this.downloadedPct = 0;
        this.downloadStart = 0;
    }
    onKickOffStart(requestOptions, url) {
        console.log("Kick-off started with URL: ", url);
        console.log("Options: ", JSON.stringify(requestOptions));
    }
    onKickOffEnd() {
        console.log("Kick-off completed");
    }
    onKickOffError(error) {
        console.log("Kick-off failed with error: ", error);
    }
    onAuthorize() {
        console.log("Got new access token");
    }
    onJobStart(status) {
        this.downloadedPct = 0;
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }
    onJobProgress(status) {
        console.log(status.message);
    }
    onJobComplete() {
        console.log("Received manifest manifest");
    }
    onJobError(details) {
        console.error("MATCH ERROR");
        console.error(JSON.stringify(details));
    }
    onDownloadStart() {
        if (!this.downloadStart) {
            console.log("Begin file downloads...");
            this.downloadStart = Date.now();
        }
    }
    onDownloadComplete() {
        console.log(`Download completed in ${lib_1.Utils.formatDuration(Date.now() - this.downloadStart)}`);
        this.downloadStart = 0;
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = TextReporter;
