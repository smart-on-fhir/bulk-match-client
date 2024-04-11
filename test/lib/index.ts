import { spawn, StdioOptions } from "child_process";
import { join } from "path";
import { BulkMatchClient as types } from "../../index";
import baseSettings from "../../config/defaults.js";
import MockServer from "./MockServer";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from "fs";

export const mockServer = new MockServer("Mock Server", true);

before(async () => {
  await mockServer.start();
});

after(async () => {
  await mockServer.stop();
});

afterEach(async () => {
  mockServer.clear();
});

export function isFile(path: string) {
  return statSync(path).isFile();
}

export function emptyFolder(path: string) {
  if (existsSync(path)) {
    readdirSync(path, { withFileTypes: true }).forEach((entry) => {
      if (entry.name !== ".gitkeep" && entry.isFile()) {
        rmSync(join(path, entry.name));
      }
    });
  }
}

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

    const spawnProcess = spawn(
      "ts-node",
      ["./src/app.ts", "--config", configPath, ...args],
      {
        cwd: join(__dirname, "../.."),
        timeout,
        stdio,
        env: {
          ...process.env,
        },
      },
    );

    spawnProcess.on("close", (code) => {
      resolve({
        config: fullOptions as types.NormalizedOptions,
        log: readFileSync(logFile, "utf8"),
        exitCode: code,
      });
    });
  });
}
