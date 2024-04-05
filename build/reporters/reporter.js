"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Reporter {
    constructor(client) {
        this.client = client;
        this.client.on("authorize", this.onAuthorize);
        this.client.on("kickOffStart", this.onKickOffStart);
        this.client.on("kickOffEnd", this.onKickOffEnd);
        this.client.on("kickOffError", this.onKickOffError);
        this.client.on("matchStart", this.onMatchStart);
        this.client.on("matchProgress", this.onMatchProgress);
        this.client.on("matchComplete", this.onMatchComplete);
        this.client.on("matchError", this.onMatchError);
        this.client.on("downloadStart", this.onDownloadStart);
        this.client.on("allDownloadsComplete", this.onDownloadComplete);
        this.client.on("error", this.onError);
    }
    // Common destroyer
    detach() {
        this.client.off("authorize", this.onAuthorize);
        this.client.off("kickOffStart", this.onKickOffStart);
        this.client.off("kickOffEnd", this.onKickOffEnd);
        this.client.off("kickOffError", this.onKickOffError);
        this.client.off("matchStart", this.onMatchStart);
        this.client.off("matchProgress", this.onMatchProgress);
        this.client.off("matchComplete", this.onMatchComplete);
        this.client.off("matchError", this.onMatchError);
        this.client.off("downloadStart", this.onDownloadStart);
        this.client.off("allDownloadsComplete", this.onDownloadComplete);
        this.client.off("error", this.onError);
    }
}
exports.default = Reporter;
