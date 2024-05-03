import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "fs";
import path, { join } from "path";
import { Logger } from "../../src";

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

export function getFixture(file: string): string {
    const fixturePath = path.join(__dirname, "../fixtures", file);
    return readFileSync(fixturePath, "utf-8");
}

export function parseLogFile(log: string) {
    return log
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

export function getLogEvents(log: string, event: Logger.LogEvents) {
    const parsedLogs = parseLogFile(log);
    return parsedLogs.find((l) => l.eventId === event);
}
