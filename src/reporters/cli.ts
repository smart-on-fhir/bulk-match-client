import "colors";
import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
import Reporter from "./reporter";

export default class CLIReporter extends Reporter {
    private downloadStart: number = 0;

    onKickOffStart(requestOptions: RequestInit, url: string) {
        Utils.print("Kick-off started with URL: " + url).commit();
        Utils.print("Options: " + JSON.stringify(requestOptions)).commit();
    }

    onKickOffEnd() {
        Utils.print("Kick-off completed").commit();
    }

    onKickOffError(error: Error) {
        Utils.print("Kick-off failed with error: " + error.message).commit();
    }

    onAuthorize() {
        Utils.print("Got new access token").commit();
    }

    onJobStart(status: Types.MatchStatus) {
        Utils.print(status.message).commit();
        Utils.print(`Status endpoint: ${status.statusEndpoint}`).commit();
    }

    onJobProgress(status: Types.MatchStatus) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        Utils.print(message).commit();
        Utils.print(
            `Job started at ${startedAt}, ${elapsedTime} time has elapsed and job is ${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}. Will try again after ${nextCheckAfter}`,
        ).commit();
    }

    onJobComplete(manifest: Types.MatchManifest) {
        Utils.print("Received manifest manifest").commit();
        Utils.print(JSON.stringify(manifest)).commit();
    }

    onJobError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }) {
        Utils.print("There was an error in the matching process").commit();
        Utils.print(JSON.stringify(details)).commit();
    }

    onDownloadStart() {
        if (!this.downloadStart) this.downloadStart = Date.now();
    }

    onDownloadComplete() {
        console.log(
            `Download completed in ${Utils.formatDuration(Date.now() - this.downloadStart)}`,
        );
        // Reset to 0
        this.downloadStart = 0;
    }

    onError(error: Error) {
        console.error(error);
    }
}
