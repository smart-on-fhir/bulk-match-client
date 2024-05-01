import { BulkMatchClient as Types } from "../..";
import BulkMatchClient from "../client/BulkMatchClient";

export default abstract class Reporter {
    private client: BulkMatchClient;
    protected abstract onAuthorize(accessToken: string): void;
    protected abstract onKickOffStart(requestOptions: RequestInit, url: string): void;
    protected abstract onKickOffEnd(data: {
        response: Types.CustomBodyResponse<object>;
        capabilityStatement: fhir4.CapabilityStatement;
        requestOptions: object;
        responseHeaders?: object;
    }): void;
    protected abstract onKickOffError(error: Error): void;
    protected abstract onJobStart(status: Types.MatchStatus): void;
    protected abstract onJobProgress(status: Types.MatchStatus): void;
    protected abstract onJobComplete(manifest: Types.MatchManifest): void;
    protected abstract onJobError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }): void;
    protected abstract onDownloadStart(): void;
    protected abstract onDownloadComplete(): void;
    protected abstract onError(error: Error): void;
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
        this.client.on("allDownloadsComplete", this.onDownloadComplete);
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
        this.client.off("allDownloadsComplete", this.onDownloadComplete);
        this.client.off("error", this.onError);
    }
}
