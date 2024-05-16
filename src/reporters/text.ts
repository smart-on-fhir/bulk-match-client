import { debuglog } from "util";
import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
import Reporter from "./reporter";
const debug = debuglog("bulk-match-text-reporter");

export default class TextReporter extends Reporter {
    onKickOffStart(requestOptions: RequestInit, url: string) {
        console.log("Kick-off started with URL: ", url);
        debug("Options: " + JSON.stringify(requestOptions));
    }

    onKickOffEnd() {
        console.log("Kick-off completed");
    }

    onKickOffError({ error }: { error: Error }) {
        console.log("Kick-off failed with error: ", error.message);
    }

    onAuthorize() {
        console.log("Authorized");
    }

    onJobStart(status: Types.MatchStatus) {
        console.log(status.message);
        debug(`Status endpoint: ${status.statusEndpoint}`);
    }

    onJobProgress(status: Types.MatchStatus) {
        const { startedAt, elapsedTime, percentComplete, nextCheckAfter, message } = status;
        console.log(message);
        debug(
            `Job started at ${new Date(startedAt).toISOString()}, ${Utils.formatDuration(elapsedTime)} time has elapsed and job is ` +
                `${percentComplete !== -1 ? `${percentComplete}% complete` : "still in progress"}.` +
                `${nextCheckAfter !== -1 ? ` Will try again after ${Utils.formatDuration(nextCheckAfter)}.` : ""}`,
        );
    }

    onJobComplete(manifest: Types.MatchManifest) {
        console.log("Received manifest manifest");
        debug(JSON.stringify(manifest));
    }

    onJobError(details: {
        body: string | fhir4.OperationOutcome | null;
        code: number | null;
        message?: string;
        responseHeaders?: object;
    }) {
        console.error("There was an error in the matching process: ", JSON.stringify(details));
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
        console.log(
            `Begin ${itemType}-file download for ${fileUrl} at ${Utils.formatDatetimeTimestamp(startTime)}...`,
        );
    }

    onDownloadComplete({ fileUrl, duration }: { fileUrl: string; duration: string }) {
        console.log(`${fileUrl} download completed in ${duration}`);
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
        console.log(`${fileUrl} download FAILED in ${duration} Message: ${message}`);
        if (responseHeaders) debug("Headers: ", JSON.stringify(responseHeaders));
    }

    onAllDownloadsComplete(_: unknown, duration: string) {
        console.log(`All downloads completed in ${duration}`);
    }

    onError(error: Error) {
        console.error(error);
    }
}
