import "colors";
import { debuglog } from "util";
import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
import Reporter from "./reporter";

const debug = debuglog("bulk-match-cli-reporter");

export default class CLIReporter extends Reporter {
    onKickOffStart(requestOptions: RequestInit, url: string) {
        Utils.print("Kick-off started with URL: " + url).commit();
        debug("Options: " + JSON.stringify(requestOptions));
    }

    onKickOffEnd() {
        Utils.print("Kick-off completed").commit();
    }

    onKickOffError({ error }: { error: Error }) {
        Utils.print("Kick-off failed with error: " + error.message).commit();
    }

    onAuthorize() {
        Utils.print("Authorized").commit();
    }

    onJobStart(status: Types.MatchStatus) {
        Utils.print(`${status.message}, using status endpoint ${status.statusEndpoint}`).commit();
    }

    onJobProgress(status: Types.MatchStatus) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        Utils.print(message);
        debug(
            `Job started at ${Utils.formatDatetimeTimestamp(startedAt)}, ${Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
                `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
                `${nextCheckAfter !== -1 ? ` Will try again after ${Utils.formatDuration(nextCheckAfter)}.` : ""}`,
        );
    }

    onJobComplete(manifest: Types.MatchManifest) {
        Utils.print.commit();
        Utils.print("Received manifest manifest").commit();
        debug(JSON.stringify(manifest));
    }

    onJobError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }) {
        Utils.print(
            "There was an error in the matching process: " + JSON.stringify(details),
        ).commit();
    }

    onDownloadStart({
        fileUrl,
        itemType,
        startTime,
    }: {
        fileUrl: string;
        itemType: string;
        startTime: number;
    }) {
        Utils.print(
            `Begin ${itemType === "error" ? "error-file " : " "}download for ${fileUrl} at ${Utils.formatDatetimeTimestamp(startTime)}...`,
        ).commit();
    }
    onDownloadComplete({ fileUrl, duration }: { fileUrl: string; duration: string }) {
        Utils.print(`${fileUrl} download complete in ${duration}`).commit();
    }
    onDownloadError({
        fileUrl,
        message,
        duration,
        responseHeaders,
    }: {
        fileUrl: string;
        message: string;
        duration: string;
        responseHeaders?: object;
    }) {
        Utils.print(`${fileUrl} download failed in ${duration}. Message: ${message}`).commit();
        if (responseHeaders) debug("responseHeaders: ", JSON.stringify(responseHeaders));
    }

    onAllDownloadsComplete(_: unknown, duration: string) {
        Utils.print(`All downloads completed in ${duration}`).commit();
    }

    onError(error: Error) {
        console.error(error);
    }
}
