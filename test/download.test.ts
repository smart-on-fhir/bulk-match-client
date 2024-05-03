import { expect } from "@hapi/code";
import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import baseSettings from "../config/defaults.js";
import { BulkMatchClient } from "../src/client";
import { Utils, invoke, mockServer } from "./lib";

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

    it.skip("Integration: Manifest will be parsed and all output files will be downloaded", async () => {
        // Mock the kick-off response
        mockServer.mock(
            { method: "post", path: "/Patient/\\$bulk-match" },
            {
                status: 202,
                headers: {
                    "Content-Location": mockServer.baseUrl + "/status",
                },
            },
        );

        // Mock the status response
        mockServer.mock("/status", {
            status: 200,
            body: {
                transactionTime: new Date().toISOString(),
                request: mockServer.baseUrl + "/Patient/$bulk-match",
                requiresAccessToken: true,
                output: [
                    {
                        type: "Bundle",
                        url: mockServer.baseUrl + "/output/file_1.ndjson",
                    },
                ],
                error: [],
            },
        });

        // Mock the download response – an NDJSON string
        const mockResponse = {
            status: 200,
            headers: { "content-type": "application/ndjson" },
            body: [
                {
                    resourceType: "Patient",
                    id: "123",
                },
            ]
                .map((x) => JSON.stringify(x))
                .join("\n"),
        };
        mockServer.mock("/output/file_1.ndjson", mockResponse);

        await invoke({
            options: {
                fhirUrl: mockServer.baseUrl,
                destination: join(__dirname, "./tmp/downloads"),
            },
        });

        // Parse both JSON objects to avoid encoding quirks re: quotation marks
        expect(
            JSON.parse(readFileSync(join(__dirname, "./tmp/downloads/file_1.ndjson"), "utf8")),
        ).to.equal(JSON.parse(mockResponse.body));
    });
});
