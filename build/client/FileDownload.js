"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
const request_1 = __importDefault(require("../lib/request"));
// import { BulkMatchClient as Types } from "../.."
// import { FileDownloadError }  from "./errors"
const debug = util_1.default.debuglog("bulk-match-file-download");
class FileDownload {
    constructor(url) {
        this.url = url;
    }
    run(options = {}) {
        const { signal, accessToken, requestOptions = {} } = options;
        const localOptions = {
            ...requestOptions,
            signal,
            headers: {
                ...requestOptions.headers,
            },
        };
        if (accessToken) {
            // We know headers is going to be an object since we set it above
            localOptions.headers.authorization =
                `Bearer ${accessToken}`;
        }
        debug(`Making download request to ${this.url} with options:\n ${JSON.stringify(localOptions)}`);
        return (0, request_1.default)(this.url, localOptions);
    }
}
exports.default = FileDownload;
