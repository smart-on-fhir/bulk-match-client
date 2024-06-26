import Crypto from "crypto";
import { resolve } from "path";
import { createLogger as _createLogger, format, transports } from "winston";
import { BulkMatchClient as Types } from "../..";

const { combine, timestamp, uncolorize, printf } = format;

export type LogEvents =
    | "authorize"
    | "kickoff_start"
    | "kickoff_error"
    | "kickoff_complete"
    | "status_progress"
    | "status_error"
    | "status_complete"
    | "download_request"
    | "download_complete"
    | "download_error"
    | "all_downloads_complete";

export function createLogger(options: Types.LoggingOptions = {}) {
    const matchId = Crypto.randomBytes(10).toString("hex");
    return _createLogger({
        silent: options.enabled === false,
        transports: [
            new transports.File({
                filename: options.file || resolve(__dirname, "../../downloads/log.ndjson"),
                maxFiles: 5,
                maxsize: 1024 * 1024 * 50,
                tailable: true,
                level: "silly",
                eol: "\n",
            }),
        ],
        format: combine(
            timestamp({ format: "isoDateTime" }),
            uncolorize(),
            printf((info) =>
                JSON.stringify({
                    ...options.metadata,
                    matchId,
                    timestamp: info.timestamp,
                    eventId: info.eventId as LogEvents,
                    eventDetail: info.eventDetail,
                }),
            ),
        ),
    });
}
