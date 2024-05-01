import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
import Reporter from "./reporter";
export default class TextReporter extends Reporter {
    private downloadStart = 0;

    onKickOffStart(requestOptions: RequestInit, url: string) {
        console.log("Kick-off started with URL: ", url);
        console.log("Options: ", JSON.stringify(requestOptions));
    }

    onKickOffEnd() {
        console.log("Kick-off completed");
    }

    onKickOffError(error: Error) {
        console.log("Kick-off failed with error: ", error.message);
    }

    onAuthorize() {
        console.log("Got new access token");
    }

    onJobStart(status: Types.MatchStatus) {
        console.log(status.message);
        console.log(`Status endpoint: ${status.statusEndpoint}`);
    }

    onJobProgress(status: Types.MatchStatus) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        console.log(message);
        console.log(
            `Job started at ${startedAt}, ${elapsedTime} time has elapsed and job is ${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}. Will try again after ${nextCheckAfter}`,
        );
    }

    onJobComplete(manifest: Types.MatchManifest) {
        console.log("Received manifest manifest");
        console.log(JSON.stringify(manifest));
    }

    onJobError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }) {
        console.error("There was an error in the matching process");
        console.error(JSON.stringify(details));
    }

    onDownloadStart() {
        if (!this.downloadStart) {
            console.log("Begin file downloads...");
            this.downloadStart = Date.now();
        }
    }

    onDownloadComplete() {
        console.log(
            `Download completed in ${Utils.formatDuration(Date.now() - this.downloadStart)}`,
        );
        this.downloadStart = 0;
    }

    onError(error: Error) {
        console.error(error);
    }
}
