import { spawn, StdioOptions } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import baseSettings from "../../config/template-config.js";
import { BulkMatchClient as types } from "../../index";
import MockServer from "./MockServer";
export * as Utils from "./utils";

// Setup server for use by tests
export const mockServer = new MockServer("Mock Server", true);

/**
 * Invokes the client and replies with a promise that will resolve when the
 * download is complete
 */
interface InvokeArguments {
    /**
     * Any custom options to pass
     */
    options?: Partial<types.NormalizedOptions>;

    /**
     * Any custom arguments to pass
     */
    args?: string[];

    /**
     * Timeout in milliseconds. Defaults to `30000`.
     */
    timeout?: number;

    /**
     * Stdio option for the process
     */
    stdio?: StdioOptions;
}
export async function invoke({
    options = {},
    args = [],
    timeout = 30000,
    stdio = "pipe",
}: InvokeArguments = {}): Promise<{
    config: types.NormalizedOptions;
    log: string;
    exitCode: number | null;
}> {
    // Can override STDIO with env var
    const finalStdio = process.env.ALL_TEST_OUTPUT ? "inherit" : stdio;
    return new Promise((resolve) => {
        const logFile = join(__dirname, "../tmp/log.ndjson");
        const fullOptions = {
            ...baseSettings,
            destination: join(__dirname, "../tmp/downloads"),
            fhirUrl: mockServer.baseUrl,
            ...options,
            reporter: "text",
            log: {
                ...baseSettings.log,
                ...options.log,
                file: logFile,
            },
        };

        const configPath = join(__dirname, "../tmp/config.js");

        writeFileSync(
            configPath,
            "module.exports = " + JSON.stringify(fullOptions, null, 4),
            "utf8",
        );

        const spawnProcess = spawn("ts-node", ["./src/app.ts", "--config", configPath, ...args], {
            cwd: join(__dirname, "../.."),
            timeout,
            stdio: finalStdio,
            env: {
                ...process.env,
            },
        });

        spawnProcess.on("close", (code) => {
            resolve({
                config: fullOptions as types.NormalizedOptions,
                log: readFileSync(logFile, "utf8"),
                exitCode: code,
            });
        });
    });
}
