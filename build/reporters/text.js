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
    onKickOffStart() {
        console.log("Kick-off started");
    }
    onKickOffEnd() {
        console.log("Kick-off completed");
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
        console.log("Received export manifest");
    }
    onDownloadStart() {
        if (!this.downloadStart) {
            console.log("Begin file downloads...");
            this.downloadStart = Date.now();
        }
    }
    onDownloadProgress(downloads) {
        const done = downloads.filter(d => d.completed);
        const pct = Math.round(done.length / downloads.length * 100);
        if (this.downloadedPct != pct) {
            this.downloadedPct = pct;
            // Only show up to 20 progress messages
            if (pct % 5 === 0) {
                const size1 = done.reduce((prev, cur) => prev + cur.downloadedBytes, 0);
                const size2 = done.reduce((prev, cur) => prev + cur.uncompressedBytes, 0);
                let line = `${pct}%`.padStart(4) + " - " +
                    `${done.length}`.padStart(String(downloads.length).length) +
                    ` out of ${downloads.length} files downloaded - ` +
                    `${(0, utils_1.humanFileSize)(size1)} total`;
                if (size2 != size1) {
                    line += ` (${(0, utils_1.humanFileSize)(size2)} uncompressed)`;
                }
                console.log(line);
            }
        }
    }
    onDownloadComplete() {
        console.log(`Download completed in ${(0, utils_1.formatDuration)(Date.now() - this.downloadStart)}`);
    }
    onError(error) {
        console.error(error);
    }
}
exports.default = TextReporter;
