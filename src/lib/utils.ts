/* eslint-disable @typescript-eslint/ban-ts-comment */
import "colors";
import jwt from "jsonwebtoken";
import moment from "moment";
import { URL } from "url";
import util from "util";
import { isRegExp } from "util/types";
import { JsonObject, BulkMatchClient as Types } from "../..";
import request from "./request";

const debug = util.debuglog("bulk-match-utils");

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// Client-specific helpers

/**
 * Filter a Headers object down to a selected series of headers
 * @param headers The object of headers to filter
 * @param selectedHeaders The headers that should remain post-filter
 * @returns object | undefined
 */
export function filterResponseHeaders(
    headers: Types.ResponseHeaders,
    selectedHeaders: (string | RegExp)[],
): object | undefined {
    // In the event the headers is undefined or null, just return undefined
    if (!headers) return undefined;
    // NOTE: If an empty array of headers is specified, return none of them
    let matchedHeaders = {};
    for (const headerPair of headers.entries()) {
        const [key, value] = headerPair;
        // These are usually normalized to lowercase by most libraries, but just to be sure
        const lowercaseKey = key.toLocaleLowerCase();
        // Each selectedHeader is either a RegExp, where we check for matches via RegExp.test
        // or a string, where we check for matches with equality
        if (
            selectedHeaders.find((h) =>
                isRegExp(h) ? h.test(lowercaseKey) : h.toLocaleLowerCase() === lowercaseKey,
            )
        )
            matchedHeaders = { ...matchedHeaders, [key]: value };
        // If we don't find a selectedHeader that matches this header, we move on
    }
    return matchedHeaders;
}

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// Auth utils

/**
 * Given a token response, computes and returns the expiresAt timestamp.
 * Note that this should only be used immediately after an access token is
 * received, otherwise the computed timestamp will be incorrect.
 */
export function getAccessTokenExpiration(tokenResponse: Types.TokenResponse): number {
    const now = Math.floor(Date.now() / 1000);

    // Option 1 - using the expires_in property of the token response
    if (tokenResponse.expires_in) {
        return now + tokenResponse.expires_in;
    }

    // Option 2 - using the exp property of JWT tokens (must not assume JWT!)
    if (tokenResponse.access_token) {
        const tokenBody = jwt.decode(tokenResponse.access_token);
        if (tokenBody && typeof tokenBody == "object" && tokenBody.exp) {
            return tokenBody.exp;
        }
    }

    // Option 3 - if none of the above worked set this to 5 minutes after now
    return now + 300;
}

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// FHIR utils
/**
 * Given a `baseUrl` fetches a `/.well-known/smart-configuration` statement
 * from the root of the baseUrl. Note that this request is cached by default!
 * @param baseUrl The server base url
 */
export async function getWellKnownSmartConfig(baseUrl: string): Promise<JsonObject> {
    // BUGFIX: Previously a leading slash here would ignore any slugs past the base path
    const url = new URL(".well-known/smart-configuration", baseUrl);
    return request<JsonObject>(url)
        .then(async (res) => {
            debug("Fetched .well-known/smart-configuration from %s", url);
            return res.body;
        })
        .catch((e) => {
            debug(
                "Failed to fetch .well-known/smart-configuration from %s",
                url,
                e.response?.status,
                e.response?.statusText,
            );
            throw e;
        });
}

/**
 * Given a `baseUrl` fetches the `CapabilityStatement`. Note that this request
 * is cached by default!
 * @param baseUrl The server base url
 */
export async function getCapabilityStatement(baseUrl: string): Promise<fhir4.CapabilityStatement> {
    const url = new URL("metadata", baseUrl.replace(/\/*$/, "/"));
    return request<fhir4.CapabilityStatement>(url)
        .then(async (res) => {
            debug("Fetched CapabilityStatement from %s", url);
            return res.body;
        })
        .catch((e) => {
            debug(
                "Failed to fetch CapabilityStatement from %s",
                url,
                e.response?.status,
                e.response?.statusText,
            );
            throw e;
        });
}

export async function getTokenEndpointFromWellKnownSmartConfig(baseUrl: string) {
    const response = await getWellKnownSmartConfig(baseUrl);
    return (response.token_endpoint as string) || "";
}

export async function getTokenEndpointFromCapabilityStatement(baseUrl: string) {
    const oauthUrisUrl = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    const response = await getCapabilityStatement(baseUrl);
    try {
        // @ts-ignore
        const rest = response.rest.find((x) => x.mode === "server");
        // @ts-ignore
        const ext = rest.security.extension.find((x) => x.url === oauthUrisUrl).extension;
        // @ts-ignore
        const node = ext.find((x) => x.url === "token");
        // @ts-ignore
        return node.valueUri || node.valueUrl || node.valueString || "";
    } catch {
        return "";
    }
}

/**
 * Given a FHIR server baseURL, looks up it's `.well-known/smart-configuration`
 * and/or it's `CapabilityStatement` (whichever arrives first) and resolves with
 * the token endpoint as defined there.
 * If no token URL is found, return 'none'
 * @param baseUrl The base URL of the FHIR server, or 'none'
 */
export async function detectTokenUrl(baseUrl: string): Promise<string> {
    try {
        const tokenUrl = await Promise.any([
            getTokenEndpointFromWellKnownSmartConfig(baseUrl),
            getTokenEndpointFromCapabilityStatement(baseUrl),
        ]);
        return tokenUrl;
    } catch {
        debug(
            "Could not detect a tokenURL from either a well-known smart config or a capability statement; proceeding with an open-server approach",
        );
        return "none";
    }
}

/**
 * Display a FHIR codeable concept as a string
 * @param cc fhir4.CodeableConcept
 * @returns string representation of the CC
 */
export function displayCodeableConcept(cc: fhir4.CodeableConcept) {
    let display = "";
    // If there is a text display, start with that
    if (cc.text) {
        display += cc.text;
    }
    cc.coding?.map((coding, i) => {
        // Store text for each coding in an array; to be joined and added to display at the end
        const localText = [`Includes coding ${i}`];
        if (coding.system) localText.push(`System: ${coding.system}`);
        if (coding.version) localText.push(`Version: ${coding.version}`);
        if (coding.code) localText.push(`Code: ${coding.code}`);
        if (coding.display) localText.push(`Display: ${coding.display}`);
        if (localText.length > 1) {
            display += "\n" + localText.join(" ");
        }
    });
    return display;
}

export function fhirInstant(input: unknown): string {
    input = String(input || "");
    if (input) {
        const instant = moment(new Date(input as string));
        if (instant.isValid()) {
            return instant.format();
        } else {
            throw new Error(`Invalid fhirInstant: ${input}`);
        }
    }
    return "";
}

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// For Data Validation
/**
 * A generic helper for normalizing values of unknown types and string representations
 * to boolean equivalents
 * @param val value of unknown type and potentially of string-coded boolean representations
 * @returns true or false
 */
export function parseBoolean(val: unknown) {
    const RE_FALSE = /^(0|no|false|off|null|undefined|NaN|none|)$/i;
    return !RE_FALSE.test(String(val).trim());
}

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// Generic Helpers

/**
 * Simple utility for waiting. Returns a promise that will resolve after the
 * given number of milliseconds. The timer can be aborted if an `AbortSignal`
 * is passed as second argument.
 * @param ms Milliseconds to wait
 * @param signal Pass an `AbortSignal` if you want to abort the waiting
 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (signal) {
                signal.removeEventListener("abort", abort);
            }
            resolve(void 0);
        }, ms);

        function abort() {
            if (timer) {
                debug("Aborting wait timeout...");
                clearTimeout(timer);
            }
            reject("Waiting aborted");
        }

        if (signal) {
            signal.addEventListener("abort", abort, { once: true });
        }
    });
}

/**
 * Returns the byte size with units
 * @param fileSizeInBytes The size to format
 * @param useBits If true, will divide by 1000 instead of 1024
 */
export function humanFileSize(fileSizeInBytes = 0, useBits = false): string {
    let i = 0;
    const base = useBits ? 1000 : 1024;
    const units = [" ", " k", " M", " G", " T", "P", "E", "Z", "Y"].map((u) => {
        return useBits ? u + "b" : u + "B";
    });

    while (fileSizeInBytes > base && i < units.length - 1) {
        fileSizeInBytes = fileSizeInBytes / base;
        i++;
    }

    return Math.max(fileSizeInBytes, 0).toFixed(1) + units[i];
}

/**
 * Generates a progress indicator
 * @param pct The percentage
 * @returns
 */
export function generateProgress(pct = 0, length = 40) {
    pct = parseFloat(pct + "");
    if (isNaN(pct) || !isFinite(pct)) {
        pct = 0;
    }
    let spinner = "";
    const bold = [];
    const grey = [];
    for (let i = 0; i < length; i++) {
        if ((i / length) * 100 >= pct) {
            grey.push("▉");
        } else {
            bold.push("▉");
        }
    }

    if (bold.length) {
        spinner += bold.join("").bold;
    }

    if (grey.length) {
        spinner += grey.join("").grey;
    }

    return `${spinner} ${pct}%`;
}

/**
 * A helper for generic ms times as human-readable durations
 * @param ms
 * @returns
 */
export function formatDuration(ms: number) {
    const out = [];
    const meta = [
        { n: 1000 * 60 * 60 * 24 * 7, label: "week" },
        { n: 1000 * 60 * 60 * 24, label: "day" },
        { n: 1000 * 60 * 60, label: "hour" },
        { n: 1000 * 60, label: "minute" },
        { n: 1000, label: "second" },
        { n: 1, label: "millisecond" },
    ];

    meta.reduce((prev, cur) => {
        const chunk = Math.floor(prev / cur.n); // console.log(chunk)
        if (chunk) {
            out.push(`${chunk} ${cur.label}${chunk > 1 ? "s" : ""}`);
            return prev - chunk * cur.n;
        }
        return prev;
    }, ms);

    if (!out.length) {
        // @ts-ignore
        out.push(`0 ${meta.pop().label}s`);
    }

    if (out.length > 1) {
        const last = out.pop();
        out[out.length - 1] += " and " + last;
    }

    return out.join(", ");
}

/**
 * A common formatting helper for turning date-time timestamps into a common, human-readable format
 * @param t
 * @returns
 */
export function formatDatetimeTimestamp(t: number) {
    return new Date(t).toISOString();
}

/**
 * An old-school not-class style helper for maintaining clean terminal output
 */
export const print = (() => {
    let lastLinesLength = 0;

    const _print = (lines: string | string[] = "") => {
        _print.clear();
        lines = Array.isArray(lines) ? lines : [lines];
        process.stdout.write(lines.join("\n") + "\n");
        lastLinesLength = lines.length;
        return _print;
    };

    _print.clear = () => {
        if (lastLinesLength) {
            process.stdout.write("\x1B[" + lastLinesLength + "A\x1B[0G\x1B[0J");
        }
        return _print;
    };

    _print.commit = () => {
        lastLinesLength = 0;
        return _print;
    };

    return _print;
})();

/**
 * Custom assertion checker
 * @param condition the condition to assert
 * @param error The error to throw/a method for building an error to throw
 * @param ctor A constructor to build something using the error
 */
export function assert(
    condition: unknown,
    error?: string | ErrorConstructor,
    ctor = Error,
): asserts condition {
    if (!condition) {
        if (typeof error === "function") {
            throw new error();
        } else {
            throw new ctor(error || "Assertion failed");
        }
    }
}

/**
 * Method for turning the either JSON or string content of a response body into a string
 * @param body
 * @returns
 */
export function stringifyBody(body: string | object | undefined) {
    return typeof body === "object" ? JSON.stringify(body) : body;
}
