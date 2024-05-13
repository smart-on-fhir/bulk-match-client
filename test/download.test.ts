import { existsSync, rmSync } from "fs";
import { join } from "path";
import { BulkMatchClient } from "../src/client";
import baseSettings from "../src/default-config";
import { Utils, mockServer } from "./lib";

describe("download", function () {
    this.timeout(60000);

    after(async () => {
        Utils.emptyFolder(__dirname + "/tmp/downloads/error");
        Utils.emptyFolder(__dirname + "/tmp/downloads");
    });

    afterEach(async () => {
        if (existsSync(__dirname + "/tmp/log.ndjson")) {
            rmSync(__dirname + "/tmp/log.ndjson");
        }
        if (existsSync(__dirname + "/tmp/config.js")) {
            rmSync(__dirname + "/tmp/config.js");
        }
    });

    it("_downloadFile method works", async () => {
        mockServer.mock("/download", {
            status: 200,
            body: '{"resourceType":"Patient"}\n' + '{"resourceType":"Patient"}',
            headers: {
                "content-type": "application/ndjson",
            },
        });

        const client = new BulkMatchClient({
            ...baseSettings,
            fhirUrl: mockServer.baseUrl,
            destination: join(__dirname, "./tmp/downloads"),
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await client._downloadFile({
            file: {
                type: "Patient",
                url: mockServer.baseUrl + "/download",
                count: 2,
            },
            fileName: "1.Patient.ndjson",
            subFolder: "",
        });
    });
});
