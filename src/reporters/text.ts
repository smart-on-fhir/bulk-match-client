import { BulkMatchClient as Types } from "../..";
import { formatDuration } from "../lib/utils";
import Reporter from "./reporter";
export default class TextReporter extends Reporter {
  private downloadedPct = 0;
  private downloadStart = 0;

  onKickOffStart(requestOptions: RequestInit, url: string) {
    console.log("Kick-off started with URL: ", url);
    console.log("Options: ", JSON.stringify(requestOptions));
  }

  onKickOffEnd() {
    console.log("Kick-off completed");
  }

  onKickOffError(error: Error) {
    console.log("Kick-off failed with error: ", error);
  }

  onAuthorize() {
    console.log("Got new access token");
  }

  onMatchStart(status: Types.MatchStatus) {
    this.downloadedPct = 0;
    console.log(status.message);
    console.log(`Status endpoint: ${status.statusEndpoint}`);
  }

  onMatchProgress(status: Types.MatchStatus) {
    console.log(status.message);
  }

  onMatchComplete(manifest: Types.MatchManifest) {
    console.log("Received manifest manifest");
  }

  onMatchError(details: {
    body: string | fhir4.OperationOutcome | null;
    code: number | null;
    message?: string;
    responseHeaders?: object;
  }) {
    console.error("MATCH ERROR");
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
      `Download completed in ${formatDuration(Date.now() - this.downloadStart)}`,
    );
    this.downloadStart = 0;
  }

  onError(error: Error) {
    console.error(error);
  }
}
