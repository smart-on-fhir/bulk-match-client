"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../lib/utils");
require("colors");
const reporter_1 = __importDefault(require("./reporter"));
class CLIReporter extends reporter_1.default {
    constructor() {
        super(...arguments);
        this.downloadStart = 0;
    }
    onKickOffStart(requestOptions, url) {
        (0, utils_1.print)("Kick-off started with URL: " + url).commit();
        (0, utils_1.print)("Options: " + JSON.stringify(requestOptions)).commit();
    }
    onKickOffEnd() {
        (0, utils_1.print)("Kick-off completed").commit();
    }
    onKickOffError(error) {
        (0, utils_1.print)("Kick-off failed with error: " + error.message).commit();
    }
    onAuthorize() {
        (0, utils_1.print)("Got new access token").commit();
    }
    onMatchStart(status) {
        (0, utils_1.print)(status.message).commit();
        (0, utils_1.print)(`Status endpoint: ${status.statusEndpoint}`).commit();
    }
    onMatchProgress(status) {
        (0, utils_1.print)(status.message).commit();
    }
    onMatchComplete(manifest) {
        utils_1.print.commit();
    }
    onMatchError(details) {
        (0, utils_1.print)("MATCH ERROR");
        (0, utils_1.print)(JSON.stringify(details));
    }
    onDownloadStart() {
        if (!this.downloadStart)
            this.downloadStart = Date.now();
    }
    onDownloadComplete() {
        console.log(`Download completed in ${(0, utils_1.formatDuration)(Date.now() - this.downloadStart)}`);
        // Reset to 0
        this.downloadStart = 0;
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = CLIReporter;
