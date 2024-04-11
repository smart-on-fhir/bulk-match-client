"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../lib/utils");
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
    onMatchStart(status) {
        this.downloadedPct = 0;
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }
    onMatchProgress(status) {
        console.log(status.message);
    }
    onMatchComplete(manifest) {
        console.log("Received manifest manifest");
    }
    onMatchError(details) {
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
        console.log(`Download completed in ${(0, utils_1.formatDuration)(Date.now() - this.downloadStart)}`);
        this.downloadStart = 0;
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = TextReporter;
