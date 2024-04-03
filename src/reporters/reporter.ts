import BulkMatchClient              from "../client/BulkMatchClient"
import { BulkMatchClient as Types } from "../.."


export default abstract class Reporter { 
    private client: BulkMatchClient;
    protected abstract onKickOffStart(): void;
    protected abstract onKickOffEnd(): void;
    protected abstract onAuthorize(): void;
    protected abstract onMatchStart(status: Types.MatchStatus): void;
    protected abstract onMatchProgress(status: Types.MatchStatus): void;
    protected abstract onMatchComplete(manifest: Types.MatchManifest): void;
    protected abstract onMatchError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }): void;
    protected abstract onDownloadStart(): void;
    protected abstract onDownloadComplete(): void;
    protected abstract onError(error: Error): void;
    constructor(client: BulkMatchClient) { 
        this.client = client
        this.client.on("authorize"           , this.onAuthorize)
        this.client.on("kickOffStart"        , this.onKickOffStart)
        this.client.on("kickOffEnd"          , this.onKickOffEnd)
        this.client.on("matchStart"          , this.onMatchStart)
        this.client.on("matchProgress"       , this.onMatchProgress)
        this.client.on("matchComplete"       , this.onMatchComplete)
        this.client.on("matchError"          , this.onMatchError)
        this.client.on("downloadStart"       , this.onDownloadStart)
        this.client.on("allDownloadsComplete", this.onDownloadComplete)
        this.client.on("error"               , this.onError)
    }
    // Common destroyer
        public detach(): void { 
            this.client.off("authorize"           , this.onAuthorize)
            this.client.off("kickOffStart"        , this.onKickOffStart)
            this.client.off("kickOffEnd"          , this.onKickOffEnd)
            this.client.off("matchStart"          , this.onMatchStart)
            this.client.off("matchProgress"       , this.onMatchProgress)
            this.client.off("matchComplete"       , this.onMatchComplete)
            this.client.off("matchError"          , this.onMatchError)
            this.client.off("downloadStart"       , this.onDownloadStart)
            this.client.off("allDownloadsComplete", this.onDownloadComplete)
            this.client.off("error"               , this.onError)
        }
}