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
    Utils.print(status.message).commit();
  }

  onJobComplete() {
    Utils.print.commit();
  }

  onJobError(details: {
    body: string | fhir4.OperationOutcome | null;
    code: number | null;
    message?: string;
    responseHeaders?: object;
  }) {
    Utils.print("MATCH ERROR");
    Utils.print(JSON.stringify(details));
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
