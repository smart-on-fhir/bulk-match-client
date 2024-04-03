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
    onKickOffStart() {
        console.log("Kick-off started");
    }
    onKickOffEnd() {
        console.log("Kick-off completed");
    }
    onAuthorize() {
        (0, utils_1.print)("Got new access token").commit();
    }
    onMatchStart(status) {
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }
    onMatchProgress(status) {
        (0, utils_1.print)(status.message);
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
