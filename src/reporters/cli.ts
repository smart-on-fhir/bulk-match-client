import "colors";
import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
import Reporter from "./reporter";

export default class CLIReporter extends Reporter {
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
            `Job started at ${new Date(startedAt).toISOString()}, ${Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
                `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
                `${nextCheckAfter !== -1 ? ` Will try again after ${Utils.formatDuration(nextCheckAfter)}.` : ""}`,
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

    onDownloadStart({
        fileUrl,
        itemType,
        duration,
    }: {
        fileUrl: string;
        itemType: string;
        duration: number;
    }) {
        Utils.print(
            `Begin ${itemType}-file download for ${fileUrl} at ${Utils.formatDuration(duration)}...`,
        ).commit();
    }
    onDownloadComplete({ fileUrl, duration }: { fileUrl: string; duration: number }) {
        Utils.print(`${fileUrl} download complete in ${Utils.formatDuration(duration)}`).commit();
    }
    onDownloadError({
        fileUrl,
        message,
        duration,
    }: {
        fileUrl: string;
        message: string;
        duration: number;
    }) {
        Utils.print(`${fileUrl} download failed in ${Utils.formatDuration(duration)}`).commit();
        Utils.print("Message: " + message).commit();
    }

    onAllDownloadsComplete(_: unknown, duration: number) {
        Utils.print(`Download completed in ${Utils.formatDuration(duration)}`).commit();
    }

    onError(error: Error) {
        console.error(error);
    }
}
