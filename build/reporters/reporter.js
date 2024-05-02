"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Reporter {
    constructor(client) {
        this.client = client;
        this.client.on("authorize", this.onAuthorize);
        this.client.on("kickOffStart", this.onKickOffStart);
        this.client.on("kickOffEnd", this.onKickOffEnd);
        this.client.on("kickOffError", this.onKickOffError);
        this.client.on("jobStart", this.onJobStart);
        this.client.on("jobProgress", this.onJobProgress);
        this.client.on("jobComplete", this.onJobComplete);
        this.client.on("jobError", this.onJobError);
        this.client.on("downloadStart", this.onDownloadStart);
        this.client.on("downloadError", this.onDownloadError);
        this.client.on("downloadComplete", this.onDownloadComplete);
        this.client.on("allDownloadsComplete", this.onAllDownloadsComplete);
        this.client.on("error", this.onError);
    }
    // Common destroyer
    detach() {
        this.client.off("authorize", this.onAuthorize);
        this.client.off("kickOffStart", this.onKickOffStart);
        this.client.off("kickOffEnd", this.onKickOffEnd);
        this.client.off("kickOffError", this.onKickOffError);
        this.client.off("jobStart", this.onJobStart);
        this.client.off("jobProgress", this.onJobProgress);
        this.client.off("jobComplete", this.onJobComplete);
        this.client.off("jobError", this.onJobError);
        this.client.off("downloadStart", this.onDownloadStart);
        this.client.off("downloadError", this.onDownloadError);
        this.client.off("downloadComplete", this.onDownloadComplete);
        this.client.off("allDownloadsComplete", this.onAllDownloadsComplete);
        this.client.off("error", this.onError);
    }
}
exports.default = Reporter;
