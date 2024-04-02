import { BulkMatchClient as Types } from "../.."
import { formatDuration, humanFileSize } from "../lib/utils";
import Reporter from './reporter'
export default class TextReporter extends Reporter { 
    private downloadedPct = 0;
    private downloadStart = 0;

    onKickOffStart() {
        console.log("Kick-off started")
    }

    onKickOffEnd() {
        console.log("Kick-off completed")
    }

    onAuthorize() {
        console.log("Got new access token")
    }

    onMatchStart(status: Types.MatchStatus) {
        this.downloadedPct = 0;
        console.log(status.message)
        console.log(`Status endpoint: ${status.statusEndpoint}`)
    }

    onMatchProgress(status: Types.MatchStatus) {
        console.log(status.message)
    }

    onMatchComplete(manifest: Types.MatchManifest) {
        console.log("Received export manifest")
    }

    onDownloadStart() {
        if (!this.downloadStart) {
            console.log("Begin file downloads...")
            this.downloadStart = Date.now()
        }
    }

    onDownloadProgress(downloads: Types.FileDownload[]) {
        const done = downloads.filter(d => d.completed)
        const pct = Math.round(done.length / downloads.length * 100);
        if (this.downloadedPct != pct) {
            this.downloadedPct = pct
            
            // Only show up to 20 progress messages
            if (pct % 5 === 0) {
                const size1: number = done.reduce((prev: number, cur) => prev + cur.downloadedBytes  , 0);
                const size2: number = done.reduce((prev: number, cur) => prev + cur.uncompressedBytes, 0);
                
                let line = `${pct}%`.padStart(4) + " - " +
                    `${done.length}`.padStart(String(downloads.length).length) +
                    ` out of ${downloads.length} files downloaded - ` +
                    `${humanFileSize(size1)} total`;

                if (size2 != size1) {
                    line += ` (${humanFileSize(size2)} uncompressed)`
                }

                console.log(line)
            }
        }
    }

    onDownloadComplete() {
        console.log(`Download completed in ${formatDuration(Date.now() - this.downloadStart)}`)
    }

    onError(error: Error) {
        console.error(error)
    }
}