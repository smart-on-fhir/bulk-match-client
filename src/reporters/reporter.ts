import BulkMatchClient              from "../lib/BulkMatchClient"
import { BulkMatchClient as Types } from "../.."


export default abstract class Reporter { 
    private client: BulkMatchClient;
    abstract onKickOffStart(): void;
    abstract onKickOffEnd(): void;
    abstract onAuthorize(): void;
    abstract onMatchStart(status: Types.MatchStatus): void;
    abstract onMatchProgress(status: Types.MatchStatus): void;
    abstract onMatchComplete(manifest: Types.MatchManifest): void;
    abstract onDownloadStart(): void;
    abstract onDownloadProgress(downloads: Types.FileDownload[]): void;
    abstract onDownloadComplete(): void;
    abstract onError(error: Error): void;
    constructor(client: BulkMatchClient) { 
        this.client = client
        this.client.on("authorize"           , this.onAuthorize)
        this.client.on("kickOffStart"        , this.onKickOffStart)
        this.client.on("kickOffEnd"          , this.onKickOffEnd)
        this.client.on("matchStart"   , this.onMatchStart)
        this.client.on("matchProgress", this.onMatchProgress)
        this.client.on("matchComplete", this.onMatchComplete)
        this.client.on("downloadStart"       , this.onDownloadStart)
        this.client.on("downloadProgress"    , this.onDownloadProgress)
        this.client.on("allDownloadsComplete", this.onDownloadComplete)
        this.client.on("error"               , this.onError)
    }
    // Common destroyer
        public detach(): void { 
            this.client.off("authorize"           , this.onAuthorize)
            this.client.off("kickOffStart"        , this.onKickOffStart)
            this.client.off("kickOffEnd"          , this.onKickOffEnd)
            this.client.on("matchStart"    , this.onMatchStart)
            this.client.off("matchProgress" , this.onMatchProgress)
            this.client.off("matchComplete" , this.onMatchComplete)
            this.client.off("downloadStart"       , this.onDownloadStart)
            this.client.off("downloadProgress"    , this.onDownloadProgress)
            this.client.off("allDownloadsComplete", this.onDownloadComplete)
            this.client.off("error"               , this.onError)
        }
}