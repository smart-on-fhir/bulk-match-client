import { BulkMatchClientEvents as BMCE } from "../client";
import BulkMatchClient from "../client/BulkMatchClient";

export default abstract class Reporter {
    private client: BulkMatchClient;
    protected abstract onAuthorize(
        ...args: Parameters<BMCE["authorize"]>
    ): ReturnType<BMCE["authorize"]>;

    protected abstract onKickOffStart(
        ...args: Parameters<BMCE["kickOffStart"]>
    ): ReturnType<BMCE["kickOffStart"]>;

    protected abstract onKickOffEnd(
        ...args: Parameters<BMCE["kickOffEnd"]>
    ): ReturnType<BMCE["kickOffEnd"]>;

    protected abstract onKickOffError(
        ...args: Parameters<BMCE["kickOffError"]>
    ): ReturnType<BMCE["kickOffError"]>;

    protected abstract onJobStart(
        ...args: Parameters<BMCE["jobStart"]>
    ): ReturnType<BMCE["jobStart"]>;

    protected abstract onJobProgress(
        ...args: Parameters<BMCE["jobProgress"]>
    ): ReturnType<BMCE["jobProgress"]>;

    protected abstract onJobComplete(
        ...args: Parameters<BMCE["jobComplete"]>
    ): ReturnType<BMCE["jobComplete"]>;

    protected abstract onJobError(
        ...args: Parameters<BMCE["jobError"]>
    ): ReturnType<BMCE["jobError"]>;

    protected abstract onDownloadStart(
        ...args: Parameters<BMCE["downloadStart"]>
    ): ReturnType<BMCE["downloadStart"]>;

    protected abstract onDownloadComplete(
        ...args: Parameters<BMCE["downloadComplete"]>
    ): ReturnType<BMCE["downloadComplete"]>;

    protected abstract onDownloadError(
        ...args: Parameters<BMCE["downloadError"]>
    ): ReturnType<BMCE["downloadError"]>;

    protected abstract onAllDownloadsComplete(
        ...args: Parameters<BMCE["allDownloadsComplete"]>
    ): ReturnType<BMCE["allDownloadsComplete"]>;

    protected abstract onError(...args: Parameters<BMCE["error"]>): ReturnType<BMCE["error"]>;

    constructor(client: BulkMatchClient) {
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
    public detach(): void {
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
