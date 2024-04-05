import { transports, format, createLogger as _createLogger } from "winston"
import { resolve }        from "path"
import Crypto             from "crypto"
import { BulkMatchClient } from "../../index"


const { combine, timestamp, uncolorize, printf } = format;

export function createLogger(options: BulkMatchClient.LoggingOptions = {}) {
    const matchId = Crypto.randomBytes(10).toString("hex");
    return _createLogger({
        silent: options.enabled === false,
        transports: [
            new transports.File({
                filename     : options.file || resolve(__dirname, "../../downloads/log.ndjson"),
                maxFiles     : 5,
                maxsize      : 1024 * 1024 * 50,
                tailable     : true,
                level        : "silly",
                eol          : "\n"
            })
        ],
        format: combine(
            timestamp({ format: "isoDateTime" }),
            uncolorize(),
            printf(info => JSON.stringify({
                ...options.metadata,
                matchId,
                timestamp  : info.timestamp,
                eventId    : info.eventId,
                eventDetail: info.eventDetail
            }))
        )
    })
}