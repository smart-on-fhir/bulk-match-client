/* eslint-disable @typescript-eslint/ban-ts-comment */
import "colors";
import prompt from "prompt-sync";
import util from "util";
import { BulkMatchClient as Types } from "../..";
import pkg from "../../package.json";
import { print } from "./utils";

const debug = util.debuglog("bulk-match-request");

async function augmentedFetch<T>(
  input: RequestInfo | URL,
  options: Types.AugmentedRequestInit = {},
): Promise<Types.CustomBodyResponse<T>> {
  // Before requests: augment options to include a custom header
  if (!options.headers) {
    options.headers = {};
  }
  // @ts-ignore
  options.headers["user-agent"] =
    `SMART-On-FHIR Bulk Match Client / ${pkg.version}`;

  //@ts-ignore
  return (
    fetch(input, options)
      // After requests – handle logging and retrying
      .then(async (response) => {
        let body = await response.text();
        const contentType = response.headers.get("content-type") || "";
        if (body.length && contentType.match(/\bjson\b/i)) {
          body = JSON.parse(body);
        }

        if (!response.ok) {
          // @ts-ignore
          throw new Error(body?.message || body || response.statusText);
        }
        debug(
          "\n=======================================================" +
            "\n--------------------- Request -------------------------" +
            "\n%s %s\n%o\n\n%o" +
            "\n--------------------- Response ------------------------" +
            "\n%s %s\n%o\n\n%o" +
            "\n=======================================================",
          // REQUEST
          options.method,
          input,
          options.headers,
          options.body ?? "",
          // RESPONSE
          response.status,
          response.statusText,
          JSON.stringify(response.headers.entries()),
          body ?? "",
        );

        // Handle transient errors by asking the user if (s)he wants to
        // retry. Note that this only happens if the "reporter" option
        // is "cli", which implies interactive capabilities. If the
        // reporter is "text", then there may be no way to render a
        // question prompt so transient errors should be handled
        // downstream by the postprocessing components
        if (
          options?.context?.interactive &&
          body &&
          response.headers.get("Content-Type") === "application/json"
        ) {
          // @ts-ignore OperationOutcome errors
          // Parse the body from above into JSON
          const oo = JSON.parse(body) as fhir4.OperationOutcome;
          if (oo.resourceType === "OperationOutcome") {
            if (oo.issue.every((i) => i.code === "transient")) {
              const msg = oo.issue
                .map((i) => i.details?.text || i.diagnostics)
                .filter(Boolean);
              print.commit();
              console.log(
                "The server replied with transient error(s)".red.bold,
              );
              if (msg) {
                console.log("- " + msg.join("\n- "));
              }
              const answer =
                process.env.AUTO_RETRY_TRANSIENT_ERRORS ||
                prompt()("Would you like to retry? [Y/n]".cyan);
              if (!answer || answer.toLowerCase() === "y") {
                return augmentedFetch(input, options);
              } else {
                print("Cancelled by user");
                process.exit(0);
              }
            }
          }
        }

        return {
          response,
          body: body as T,
        };
      })
      .catch((e: Error) => {
        debug("FAILED fetch: ", e.message);
        console.error(e);
        throw e;
      })
  );
}

export default augmentedFetch;
