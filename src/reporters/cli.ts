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

    onDownloadStart() {
        if (!this.downloadStart) this.downloadStart = Date.now()
    }

    onDownloadProgress(downloads: Types.FileDownload[]) {
        let downloadedBytes   = 0
        let uncompressedBytes = 0
        let downloadedFiles   = 0
        let resources         = 0
        let totalFiles        = downloads.length

        downloads.forEach(d => {
            downloadedBytes   += d.downloadedBytes
            uncompressedBytes += d.uncompressedBytes
            resources         += d.resources

            if (d.completed) {
                downloadedFiles += 1
            }
        })

        const lines = [
            "",
            "Downloading exported files".bold + `: ${generateProgress(Math.round(downloadedFiles/totalFiles * 100), 30)}`,
            `          Downloaded Files: ${downloadedFiles} of ${totalFiles}`,
            `            FHIR Resources: ${resources.toLocaleString()}`,
            `           Downloaded Size: ${humanFileSize(downloadedBytes)}`,
        ]

        if (uncompressedBytes != downloadedBytes) {
            lines.push(
                `         Uncompressed Size: ${humanFileSize(uncompressedBytes)}`,
                `         Compression ratio: 1/${(uncompressedBytes && downloadedBytes ? Math.round(uncompressedBytes/downloadedBytes) : 1)}`
            )
        }

        lines.push("")

        print(lines)
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