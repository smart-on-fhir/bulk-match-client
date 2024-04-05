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

    onKickOffStart(requestOptions: RequestInit, url: string) {
        print("Kick-off started with URL: " + url).commit()
        print("Options: " + JSON.stringify(requestOptions)).commit()
    }

    onKickOffEnd() {
        print("Kick-off completed").commit()
    }

    onKickOffError(error: Error) {
        print("Kick-off failed with error: " + error.message).commit()
    }

    onAuthorize() {
        print("Got new access token").commit()
    }

    onMatchStart(status: Types.MatchStatus) {
        print(status.message).commit()
        print(`Status endpoint: ${status.statusEndpoint}`).commit()
    }

    onMatchProgress(status: Types.MatchStatus) {
        print(status.message).commit()
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