import { BulkMatchClient as Types } from "../.."
import {
    formatDuration,
    generateProgress,
    humanFileSize,
    print
} from "../lib/utils"
import "colors"
import Reporter from "./reporter";


export default class CLIReporter extends Reporter {
    private downloadStart: number = 0;

    onKickOffStart() {
        console.log("Kick-off started")
    }

    onKickOffEnd() {
        console.log("Kick-off completed")
    }

    onAuthorize() {
        print("Got new access token").commit()
    }

    onMatchStart(status: Types.MatchStatus) {
        console.log(status.message)
        console.log(`Status endpoint: ${status.statusEndpoint}`)
    }

    onMatchProgress(status: Types.MatchStatus) {
        print(status.message)
    }

    onMatchComplete(manifest: Types.MatchManifest) {
        print.commit()
    }
    
    onMatchError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }) {
        print("MATCH ERROR")
        print(JSON.stringify(details))
    }

    onDownloadStart() {
        if (!this.downloadStart) this.downloadStart = Date.now()
    }

    onDownloadComplete() {
        console.log(`Download completed in ${formatDuration(Date.now() - this.downloadStart)}`)
        // Reset to 0 
        this.downloadStart = 0
    }

    onError(error: Error) {
        console.error(error)
    }
}