/* eslint-disable @typescript-eslint/ban-ts-comment */
import "colors";
import prompt from "prompt-sync";
import util from "util";
import { BulkMatchClient as Types } from "../..";
import pkg from "../../package.json";
import { RequestError } from "./errors";
import { isJsonResponse, print } from "./utils";

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
    options.headers["user-agent"] = `SMART-On-FHIR Bulk Match Client / ${pkg.version}`;

    //@ts-ignore
    return (
        fetch(input, options)
            // After requests – handle logging and retrying
            .then(async (response) => {
                let body = await response.text();
                if (body.length && isJsonResponse(response)) {
                    body = JSON.parse(body);
                }

                // Create eventual response now so we can use it in error objects
                const res = {
                    response,
                    body: body as T,
                };

                // Throw errors for all non-200's, except 429
                if (!response.ok && response.status !== 429) {
                    throw new RequestError<T>({
                        res,
                        method: options.method || "",
                    });
                }
                debug(
                    "\n=======================================================" +
                        "\n--------------------- Request -------------------------" +
                        "\n%s %s" +
                        "\nHeaders: %o" +
                        "\n\nBody: %o" +
                        "\n--------------------- Response ------------------------" +
                        "\n%s %s" +
                        "\nHeaders: %o" +
                        "\n\nBody: %o" +
                        "\n=======================================================",
                    // REQUEST
                    options.method || "GET",
                    input,
                    options.headers,
                    options.body ?? "",
                    // RESPONSE
                    response.status,
                    response.statusText,
                    Object.fromEntries(response.headers),
                    body ?? "",
                );

                // Handle transient errors by asking the user if (s)he wants to
                // retry. Note that this only happens if the "reporter" option
                // is "cli", which implies interactive capabilities. If the
                // reporter is "text", then there may be no way to render a
                // question prompt so transient errors should be handled
                // downstream by the postprocessing components
                if (options?.context?.interactive && body && isJsonResponse(response)) {
                    // @ts-ignore OperationOutcome errors
                    // Treat the body as an operationOutcome to check for errors
                    const oo = body as fhir4.OperationOutcome;
                    if (oo.resourceType === "OperationOutcome") {
                        if (oo.issue.every((i) => i.code === "transient")) {
                            const msg = oo.issue
                                .map((i) => i.details?.text || i.diagnostics)
                                .filter(Boolean);
                            print.commit();
                            console.log("The server replied with transient error(s)".red.bold);
                            if (msg) {
                                console.log("- " + msg.join("\n- "));
                            }
                            const answer =
                                options.autoRetryOnTransientError ||
                                prompt()("Would you like to retry? [Y/n]".cyan);
                            if (!answer || answer === true || answer.toLowerCase() === "y") {
                                return augmentedFetch(input, options);
                            } else {
                                print("Cancelled by user");
                                process.exit(0);
                            }
                        }
                    }
                }

                return res;
            })
            .catch((e: Error) => {
                debug("FAILED fetch: ", e.message);
                if (process.env.NODE_ENV !== "test") {
                    console.error(e);
                }
                throw e;
            })
    );
}

export default augmentedFetch;
