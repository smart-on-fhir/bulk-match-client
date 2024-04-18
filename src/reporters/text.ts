import { BulkMatchClient as Types } from "../..";
import { Utils } from "../lib";
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

  onJobStart(status: Types.MatchStatus) {
    this.downloadedPct = 0;
    console.log(status.message);
    console.log(`Status endpoint: ${status.statusEndpoint}`);
  }

  onJobProgress(status: Types.MatchStatus) {
    console.log(status.message);
  }

  onJobComplete() {
    console.log("Received manifest manifest");
  }

  onJobError(details: {
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
      `Download completed in ${Utils.formatDuration(Date.now() - this.downloadStart)}`,
    );
    this.downloadStart = 0;
  }

  onError(error: Error) {
    console.error(error);
  }
}
