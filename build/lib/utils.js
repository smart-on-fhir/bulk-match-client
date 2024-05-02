"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assert = exports.print = exports.formatDuration = exports.generateProgress = exports.humanFileSize = exports.wait = exports.parseBoolean = exports.fhirInstant = exports.displayCodeableConcept = exports.detectTokenUrl = exports.getTokenEndpointFromCapabilityStatement = exports.getTokenEndpointFromWellKnownSmartConfig = exports.getCapabilityStatement = exports.getWellKnownSmartConfig = exports.getAccessTokenExpiration = exports.filterResponseHeaders = void 0;
/* eslint-disable @typescript-eslint/ban-ts-comment */
require("colors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const moment_1 = __importDefault(require("moment"));
const url_1 = require("url");
const util_1 = __importDefault(require("util"));
const types_1 = require("util/types");
const request_1 = __importDefault(require("./request"));
const debug = util_1.default.debuglog("bulk-match-utils");
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// Client-specific helpers
/**
 * Filter a Headers object down to a selected series of headers
 * @param headers The object of headers to filter
 * @param selectedHeaders The headers that should remain post-filter
 * @returns object | undefined
 */
function filterResponseHeaders(headers, selectedHeaders) {
    // In the event the headers is undefined or null, just return undefined
    if (!headers)
        return undefined;
    // NOTE: If an empty array of headers is specified, return none of them
    let matchedHeaders = {};
    for (const headerPair of headers.entries()) {
        const [key, value] = headerPair;
        // These are usually normalized to lowercase by most libraries, but just to be sure
        const lowercaseKey = key.toLocaleLowerCase();
        // Each selectedHeader is either a RegExp, where we check for matches via RegExp.test
        // or a string, where we check for matches with equality
        if (selectedHeaders.find((h) => (0, types_1.isRegExp)(h) ? h.test(lowercaseKey) : h.toLocaleLowerCase() === lowercaseKey))
            matchedHeaders = { ...matchedHeaders, [key]: value };
        // If we don't find a selectedHeader that matches this header, we move on
    }
    return matchedHeaders;
}
exports.filterResponseHeaders = filterResponseHeaders;
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// Auth utils
/**
 * Given a token response, computes and returns the expiresAt timestamp.
 * Note that this should only be used immediately after an access token is
 * received, otherwise the computed timestamp will be incorrect.
 */
function getAccessTokenExpiration(tokenResponse) {
    const now = Math.floor(Date.now() / 1000);
    // Option 1 - using the expires_in property of the token response
    if (tokenResponse.expires_in) {
        return now + tokenResponse.expires_in;
    }
    // Option 2 - using the exp property of JWT tokens (must not assume JWT!)
    if (tokenResponse.access_token) {
        const tokenBody = jsonwebtoken_1.default.decode(tokenResponse.access_token);
        if (tokenBody && typeof tokenBody == "object" && tokenBody.exp) {
            return tokenBody.exp;
        }
    }
    // Option 3 - if none of the above worked set this to 5 minutes after now
    return now + 300;
}
exports.getAccessTokenExpiration = getAccessTokenExpiration;
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// FHIR utils
/**
 * Given a `baseUrl` fetches a `/.well-known/smart-configuration` statement
 * from the root of the baseUrl. Note that this request is cached by default!
 * @param baseUrl The server base url
 */
async function getWellKnownSmartConfig(baseUrl) {
    // BUGFIX: Previously a leading slash here would ignore any slugs past the base path
    const url = new url_1.URL(".well-known/smart-configuration", baseUrl);
    return (0, request_1.default)(url)
        .then(async (res) => {
        debug("Fetched .well-known/smart-configuration from %s", url);
        return res.body;
    })
        .catch((e) => {
        debug("Failed to fetch .well-known/smart-configuration from %s", url, e.response?.status, e.response?.statusText);
        throw e;
    });
}
exports.getWellKnownSmartConfig = getWellKnownSmartConfig;
/**
 * Given a `baseUrl` fetches the `CapabilityStatement`. Note that this request
 * is cached by default!
 * @param baseUrl The server base url
 */
async function getCapabilityStatement(baseUrl) {
    const url = new url_1.URL("metadata", baseUrl.replace(/\/*$/, "/"));
    return (0, request_1.default)(url)
        .then(async (res) => {
        if (res.response.status === 404) {
            throw Error(res.response.statusText);
        }
        debug("Fetched CapabilityStatement from %s", url);
        return res.body;
    })
        .catch((e) => {
        debug("Failed to fetch CapabilityStatement from %s", url, e.response?.status, e.response?.statusText);
        throw e;
    });
}
exports.getCapabilityStatement = getCapabilityStatement;
async function getTokenEndpointFromWellKnownSmartConfig(baseUrl) {
    const response = await getWellKnownSmartConfig(baseUrl);
    return response.token_endpoint || "";
}
exports.getTokenEndpointFromWellKnownSmartConfig = getTokenEndpointFromWellKnownSmartConfig;
async function getTokenEndpointFromCapabilityStatement(baseUrl) {
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
    }
    catch {
        return "";
    }
}
exports.getTokenEndpointFromCapabilityStatement = getTokenEndpointFromCapabilityStatement;
/**
 * Given a FHIR server baseURL, looks up it's `.well-known/smart-configuration`
 * and/or it's `CapabilityStatement` (whichever arrives first) and resolves with
 * the token endpoint as defined there.
 * @param baseUrl The base URL of the FHIR server
 */
async function detectTokenUrl(baseUrl) {
    try {
        const tokenUrl = await Promise.any([
            getTokenEndpointFromWellKnownSmartConfig(baseUrl),
            getTokenEndpointFromCapabilityStatement(baseUrl),
        ]);
        return tokenUrl;
    }
    catch {
        return "none";
    }
}
exports.detectTokenUrl = detectTokenUrl;
/**
 * Display a FHIR codeable concept as a string
 * @param cc fhir4.CodeableConcept
 * @returns string representation of the CC
 */
function displayCodeableConcept(cc) {
    let display = "";
    // If there is a text display, start with that
    if (cc.text) {
        display += cc.text;
    }
    cc.coding?.map((coding, i) => {
        // Store text for each coding in an array; to be joined and added to display at the end
        const localText = [`Includes coding ${i}`];
        if (coding.system)
            localText.push(`System: ${coding.system}`);
        if (coding.version)
            localText.push(`Version: ${coding.version}`);
        if (coding.code)
            localText.push(`Code: ${coding.code}`);
        if (coding.display)
            localText.push(`Display: ${coding.display}`);
        if (localText.length > 1) {
            display += "\n" + localText.join(" ");
        }
    });
    return display;
}
exports.displayCodeableConcept = displayCodeableConcept;
function fhirInstant(input) {
    input = String(input || "");
    if (input) {
        const instant = (0, moment_1.default)(new Date(input));
        if (instant.isValid()) {
            return instant.format();
        }
        else {
            throw new Error(`Invalid fhirInstant: ${input}`);
        }
    }
    return "";
}
exports.fhirInstant = fhirInstant;
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// For Data Validation
/**
 * A generic helper for normalizing values of unknown types and string representations
 * to boolean equivalents
 * @param val value of unknown type and potentially of string-coded boolean representations
 * @returns true or false
 */
function parseBoolean(val) {
    const RE_FALSE = /^(0|no|false|off|null|undefined|NaN|none|)$/i;
    return !RE_FALSE.test(String(val).trim());
}
exports.parseBoolean = parseBoolean;
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
function wait(ms, signal) {
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
exports.wait = wait;
/**
 * Returns the byte size with units
 * @param fileSizeInBytes The size to format
 * @param useBits If true, will divide by 1000 instead of 1024
 */
function humanFileSize(fileSizeInBytes = 0, useBits = false) {
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
exports.humanFileSize = humanFileSize;
/**
 * Generates a progress indicator
 * @param pct The percentage
 * @returns
 */
function generateProgress(pct = 0, length = 40) {
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
        }
        else {
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
exports.generateProgress = generateProgress;
/**
 * A helper for generic ms times as human-readable durations
 * @param ms
 * @returns
 */
function formatDuration(ms) {
    const out = [];
    const meta = [
        { n: 1000 * 60 * 60 * 24 * 7, label: "week" },
        { n: 1000 * 60 * 60 * 24, label: "day" },
        { n: 1000 * 60 * 60, label: "hour" },
        { n: 1000 * 60, label: "minute" },
        { n: 1000, label: "second" },
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
exports.formatDuration = formatDuration;
/**
 * An old-school not-class style helper for maintaining clean terminal output
 */
exports.print = (() => {
    let lastLinesLength = 0;
    const _print = (lines = "") => {
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
function assert(condition, error, ctor = Error) {
    if (!condition) {
        if (typeof error === "function") {
            throw new error();
        }
        else {
            throw new ctor(error || "Assertion failed");
        }
    }
}
exports.assert = assert;
