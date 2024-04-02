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
    onDownloadStart() {
        if (!this.downloadStart)
            this.downloadStart = Date.now();
    }
    onDownloadProgress(downloads) {
        let downloadedBytes = 0;
        let uncompressedBytes = 0;
        let downloadedFiles = 0;
        let resources = 0;
        let totalFiles = downloads.length;
        downloads.forEach(d => {
            downloadedBytes += d.downloadedBytes;
            uncompressedBytes += d.uncompressedBytes;
            resources += d.resources;
            if (d.completed) {
                downloadedFiles += 1;
            }
        });
        const lines = [
            "",
            "Downloading exported files".bold + `: ${(0, utils_1.generateProgress)(Math.round(downloadedFiles / totalFiles * 100), 30)}`,
            `          Downloaded Files: ${downloadedFiles} of ${totalFiles}`,
            `            FHIR Resources: ${resources.toLocaleString()}`,
            `           Downloaded Size: ${(0, utils_1.humanFileSize)(downloadedBytes)}`,
        ];
        if (uncompressedBytes != downloadedBytes) {
            lines.push(`         Uncompressed Size: ${(0, utils_1.humanFileSize)(uncompressedBytes)}`, `         Compression ratio: 1/${(uncompressedBytes && downloadedBytes ? Math.round(uncompressedBytes / downloadedBytes) : 1)}`);
        }
        lines.push("");
        (0, utils_1.print)(lines);
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
