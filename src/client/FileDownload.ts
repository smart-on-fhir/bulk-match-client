import util                   from "util"
import request from '../lib/request'
// import { BulkMatchClient as Types } from "../.."
// import { FileDownloadError }  from "./errors"

const debug = util.debuglog("bulk-match-file-download")

export interface FileDownloadOptions {
    signal              ?: AbortSignal
    accessToken         ?: string
    requestOptions      ?: RequestInit
}

class FileDownload 
{
    readonly url: string

    constructor(url: string) {
        this.url = url
    }

    public run(options: FileDownloadOptions = {}): Promise<Response>
    {
        const { signal, accessToken, requestOptions = {}} = options;
        const localOptions: any = {
            ...requestOptions,
            headers: {
                ...requestOptions.headers,
            }
        }
        if (accessToken) {
            localOptions.headers.authorization = `Bearer ${accessToken}`
        }

        debug(`Making download request to ${this.url} with options:\n ${JSON.stringify(localOptions)}`)

        return request(this.url, localOptions)
    }
}

export default FileDownload
