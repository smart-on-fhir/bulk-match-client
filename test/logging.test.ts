/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from "@hapi/code";
import { existsSync, rmSync } from "fs";
import { Utils, invoke, mockServer } from "./lib";

describe("Logging", function () {
    // Set longer timeout
    this.timeout(10000);

    // Start/stop/refresh mock server
    before(async () => await mockServer.start());
    after(async () => await mockServer.stop());
    afterEach(() => mockServer.clear());

    // Clean up tmp directory as needed
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

    describe("kickoff", () => {
        it("emits kickoff_start and kickoff_error in case of server error", async () => {
            mockServer.mock("/metadata", {
                status: 200,
                headers: { "content-type": "application/json" },
                body: {
                    fhirVersion: 100,
                    software: {
                        name: "Software Name",
                        version: "Software Version",
                        releaseDate: "01-02-03",
                    },
                },
            });

            // Respond with a 404 indicating server error
            mockServer.mock(
                // NOTE: Request endpoint is invalid without the "\\"
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 404, body: "", headers: { "content-location": "x" } },
            );

            const { log } = await invoke({
                options: { logResponseHeaders: [] },
            });
            console.log(log);
            console.log(mockServer);
            const entryStart = Utils.getLogEvent(log, "kickoff_start");
            expect(entryStart, "kickoff log entry not found").to.exist();
            expect(entryStart.eventDetail).to.equal(
                `Kick-off started with URL: ${mockServer.baseUrl}/Patient/$bulk-match\n` +
                    'Options: {"headers":{"Content-Type":"application/json","accept":"application/fhir+ndjson","prefer":"respond-async"},"method":"POST","body":"{\\"resourceType\\":\\"Parameters\\",\\"parameter\\":[]}"}',
            );

            const entryComplete = Utils.getLogEvent(log, "kickoff_error");
            expect(entryComplete.eventDetail).to.equal({
                error: `POST ${mockServer.baseUrl}/Patient/$bulk-match FAILED with 404 and message Not Found.`,
                softwareName: "Software Name",
                softwareVersion: "Software Version",
                softwareReleaseDate: "01-02-03",
                fhirVersion: 100,
                requestOptions: {
                    body: '{"resourceType":"Parameters","parameter":[]}',
                    headers: {
                        "Content-Type": "application/json",
                        accept: "application/fhir+ndjson",
                        prefer: "respond-async",
                    },
                    method: "POST",
                },
            });
        });

        it("emits kickoff_start & kickoff_error in case of invalid response", async () => {
            mockServer.mock("/metadata", {
                status: 200,
                headers: {
                    "content-type": "application/json",
                },
                body: {
                    fhirVersion: 100,
                    software: {
                        name: "Software Name",
                        version: "Software Version",
                        releaseDate: "01-02-03",
                    },
                },
            });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 200, body: "" },
            );

            const { log } = await invoke({
                options: { logResponseHeaders: [] },
            });
            const entryStart = Utils.getLogEvent(log, "kickoff_start");

            // Check kickoff start log for existence
            expect(entryStart, "kickoff log entry not found").to.exist();
            expect(entryStart.eventDetail).to.equal(
                `Kick-off started with URL: ${mockServer.baseUrl}/Patient/$bulk-match\n` +
                    'Options: {"headers":{"Content-Type":"application/json","accept":"application/fhir+ndjson","prefer":"respond-async"},"method":"POST","body":"{\\"resourceType\\":\\"Parameters\\",\\"parameter\\":[]}"}',
            );
            // Check error log
            const entryError = Utils.getLogEvent(log, "kickoff_error");
            expect(entryError.eventDetail).to.equal({
                error: "No content location was specified in the response",
                softwareName: "Software Name",
                softwareVersion: "Software Version",
                softwareReleaseDate: "01-02-03",
                fhirVersion: 100,
                responseHeaders: {},
                requestOptions: {
                    body: '{"resourceType":"Parameters","parameter":[]}',
                    headers: {
                        "Content-Type": "application/json",
                        accept: "application/fhir+ndjson",
                        prefer: "respond-async",
                    },
                    method: "POST",
                },
            });
        });

        it("emits kickoff_start in case of missing CapabilityStatement", async () => {
            mockServer.mock("/metadata", { status: 404 });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 200, body: "", headers: { "content-type": "application/json" } },
            );

            const { log } = await invoke({
                options: { logResponseHeaders: [] },
            });
            const entryStart = Utils.getLogEvent(log, "kickoff_start");

            expect(entryStart, "kickoff log entry not found").to.exist();
            expect(entryStart.eventDetail).to.equal(
                `Kick-off started with URL: ${mockServer.baseUrl}/Patient/$bulk-match\n` +
                    'Options: {"headers":{"Content-Type":"application/json","accept":"application/fhir+ndjson","prefer":"respond-async"},"method":"POST","body":"{\\"resourceType\\":\\"Parameters\\",\\"parameter\\":[]}"}',
            );
        });

        it("includes request parameters in kickoff log entries", async () => {
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 200, headers: { "content-type": "application/json" } },
            );

            const { log } = await invoke({
                args: ["--count", "3"],
            });

            // Kickoff start entry should include a count argument in its request options payload
            const entry = Utils.getLogEvent(log, "kickoff_start");
            expect(entry, "kickoff log entry not found").to.exist();
            expect(entry.eventDetail).to.include(mockServer.baseUrl + "/Patient/$bulk-match");
            expect(entry.eventDetail).to.include("count");
            expect(entry.eventDetail).to.include(":3");
        });

        it("kickoff_complete should include responseHeaders when logResponseHeaders is 'all'", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });

            // NOTE: Request endpoint is invalid without the "\\"
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                        "x-debugging-header": "someValue",
                    },
                    body: "",
                },
            );

            const { log } = await invoke({
                options: { logResponseHeaders: "all" },
            });
            // Should be able to find debugging header in log entries
            const entry = Utils.getLogEvent(log, "kickoff_complete");
            expect(entry, "kickoff log entry not found").to.exist();
            expect(entry.eventDetail).to.be.an.object();
            expect(entry.eventDetail.responseHeaders).to.be.an.object();
            expect(entry.eventDetail.responseHeaders).to.include({
                "x-debugging-header": "someValue",
            });
        });

        it("kickoff_complete should filter responseHeaders based on logResponseHeaders option", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });

            // NOTE: Request endpoint is invalid without the "\\"
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                        "x-debugging-header": "someValue",
                        "x-another-header": "someValue",
                    },
                    body: "",
                },
            );

            const { log } = await invoke({
                options: {
                    logResponseHeaders: ["x-debugging-header", "content-location"],
                },
            });
            const entry = Utils.getLogEvent(log, "kickoff_complete");
            expect(entry, "kickoff log entry not found").to.exist();
            expect(entry.eventDetail).to.be.an.object();
            expect(entry.eventDetail.responseHeaders).to.be.an.object();
            expect(entry.eventDetail.responseHeaders).to.equal({
                "content-location": mockServer.baseUrl + "/status",
                "x-debugging-header": "someValue",
            });
        });
    });

    describe("status events", () => {
        it("logs status_progress events in case of 202 status responses", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                    body: "",
                },
            );

            let counter = 0;

            mockServer.mock("/status", {
                handler(req, res) {
                    if (++counter < 4) {
                        res.setHeader("x-progress", counter * 30 + "%");
                        res.setHeader("retry-after", "1");
                        res.status(202);
                        res.send("");
                    } else {
                        res.json({}); // manifest
                    }
                },
            });

            const { log } = await invoke();
            const logs = Utils.getLogEvents(log, "status_progress");

            expect(logs.length, "must have 3 status_progress log entries").to.equal(3);
            expect(logs[0].eventDetail.xProgress).to.equal("30%");
            expect(logs[1].eventDetail.xProgress).to.equal("60%");
            expect(logs[2].eventDetail.xProgress).to.equal("90%");
        });

        it("logs status_error events", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                    body: "",
                },
            );

            mockServer.mock("/status", {
                status: 404,
                body: "Status endpoint not found",
                headers: { "x-debugging-header": "someValue" },
            });

            const { log } = await invoke();
            const entry = Utils.getLogEvent(log, "status_error");
            expect(entry).to.exist();
            expect(entry.eventDetail.code).to.equal(404);
            expect(entry.eventDetail.body).to.equal("Status endpoint not found");
            // Check response headers of status_error events
            expect(entry.eventDetail.responseHeaders).to.include({
                "x-debugging-header": "someValue",
            });
        });

        it("can filter responseHeaders of status_error events with client's logResponseHeaders option", async () => {
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                    body: "",
                },
            );

            mockServer.mock("/status", {
                status: 404,
                body: "Status endpoint not found",
                headers: { "x-debugging-header": "someValue", "x-another-value": "another-value" },
            });

            const { log } = await invoke({
                options: { logResponseHeaders: ["x-debugging-header"] },
            });
            const entry = Utils.getLogEvent(log, "status_error");
            expect(entry).to.exist();
            expect(entry.eventDetail.code).to.equal(404);
            expect(entry.eventDetail.body).to.equal("Status endpoint not found");
            // Check response headers of status_error events
            expect(entry.eventDetail.responseHeaders).to.equal({
                "x-debugging-header": "someValue",
            });
        });

        it("logs status_complete events", async () => {
            mockServer.mock("/metadata", { status: 200, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                    body: "",
                },
            );

            mockServer.mock("/status", {
                status: 200,
                headers: { "content-type": "application/json" },
                body: {
                    transactionTime: new Date().toISOString(),
                    output: [{}, {}, {}],
                    error: [{}],
                },
            });

            const { log } = await invoke();
            const entry = Utils.getLogEvent(log, "status_complete");
            expect(entry).to.exist();
            expect(entry.eventDetail.transactionTime).to.exist();
            expect(entry.eventDetail.outputFileCount).to.equal(3);
            expect(entry.eventDetail.errorFileCount).to.equal(1);
        });

        it("logs status_error on invalid manifest", async () => {
            this.timeout(10000);

            mockServer.mock("/metadata", { status: 200, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                    body: "",
                },
            );

            mockServer.mock("/status", {
                status: 200,
                body: {},
                headers: { "content-type": "application/json" },
            });

            const { log } = await invoke();
            const entry = Utils.getLogEvent(log, "status_error");
            expect(entry).to.exist();
            expect(entry.eventDetail.code).to.equal(200);
            expect(entry.eventDetail.body).to.equal("{}");
            expect(entry.eventDetail.message).to.equal(
                "The match manifest output is not an array: Expected undefined " +
                    "to be an array but got 'undefined'",
            );
        });
    });

    describe("download events", () => {
        it("download without errors", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                },
            );

            mockServer.mock("/status", {
                status: 200,
                headers: { "content-type": "application/json" },
                body: {
                    transactionTime: new Date().toISOString(),
                    output: [
                        {
                            url: mockServer.baseUrl + "/downloads/patient-1",
                            type: "Patient",
                        },
                        {
                            url: mockServer.baseUrl + "/downloads/patient-2",
                            type: "Patient",
                        },
                    ],
                    error: [
                        {
                            url: mockServer.baseUrl + "/downloads/errors",
                            type: "OperationOutcome",
                        },
                    ],
                },
            });

            mockServer.mock("/downloads/patient-1", {
                handler(req, res) {
                    res.set("content-type", "application/fhir+ndjson");
                    res.end('{"resourceType":"Patient"}\n{"resourceType":"Patient"}');
                },
            });

            mockServer.mock("/downloads/patient-2", {
                handler(req, res) {
                    res.set("content-type", "application/fhir+ndjson");
                    res.end('{"resourceType":"Patient"}\n{"resourceType":"Patient"}');
                },
            });

            mockServer.mock("/downloads/errors", {
                handler(req, res) {
                    res.set("content-type", "application/fhir+ndjson");
                    res.end('{"resourceType":"OperationOutcome"}');
                },
            });

            const { log } = await invoke();

            const start = Utils.getLogEvent(log, "kickoff_start");
            expect(start).to.exist();

            const statusComplete = Utils.getLogEvent(log, "status_complete");
            expect(statusComplete).to.exist();

            // /downloads/file1 ------------------------------------------------
            {
                const entries = Utils.getLogEvents(log, "download_request").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/patient-1",
                );
                expect(
                    entries.length,
                    'download_request should be logged once for "/downloads/patient-1"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/patient-1",
                );
                expect(entries[0].eventDetail.itemType).to.equal("output");
                expect(entries[0].eventDetail.startTime).to.not.be.undefined();
            }
            {
                const entries = Utils.getLogEvents(log, "download_complete").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/patient-1",
                );

                expect(
                    entries.length,
                    'download_complete should be logged once for "/downloads/patient-1"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/patient-1",
                );
            }

            // /downloads/file2 ------------------------------------------------
            {
                const entries = Utils.getLogEvents(log, "download_request").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/patient-2",
                );
                expect(
                    entries.length,
                    'download_request should be logged once for "/downloads/patient-2"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/patient-2",
                );
                expect(entries[0].eventDetail.itemType).to.equal("output");
                expect(entries[0].eventDetail.startTime).to.not.be.undefined();
            }
            {
                const entries = Utils.getLogEvents(log, "download_complete").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/patient-2",
                );
                expect(
                    entries.length,
                    'download_complete should be logged once for "/downloads/patient-2"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/patient-2",
                );
            }

            // /downloads/errors -----------------------------------------------
            {
                const entries = Utils.getLogEvents(log, "download_request").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/errors",
                );
                expect(
                    entries.length,
                    'download_request should be logged once for "/downloads/errors"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/errors",
                );
                expect(entries[0].eventDetail.itemType).to.equal("error");
            }
            {
                const entries = Utils.getLogEvents(log, "download_complete").filter(
                    (e) => e.eventDetail.fileUrl === mockServer.baseUrl + "/downloads/errors",
                );
                expect(
                    entries.length,
                    'download_complete should be logged once for "/downloads/errors"',
                ).to.equal(1);
                expect(entries[0].eventDetail.fileUrl, "invalid fileUrl").to.equal(
                    mockServer.baseUrl + "/downloads/errors",
                );
            }

            // all_downloads_complete -------------------------------------------------
            {
                const entries = Utils.getLogEvents(log, "all_downloads_complete");
                expect(entries.length, "all_downloads_complete should be logged once").to.equal(1);
                expect(entries[0].eventDetail.files, "must report 3 files").to.equal(3);
                expect(
                    entries[0].eventDetail.duration,
                    "should have a duration",
                ).to.not.be.undefined();
            }
        });

        it("logs download_error events on server errors", async () => {
            mockServer.mock("/metadata", { status: 404, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                },
            );

            mockServer.mock("/status", {
                status: 200,
                headers: { "content-type": "application/json" },
                body: {
                    transactionTime: new Date().toISOString(),
                    output: [
                        {
                            url: mockServer.baseUrl + "/downloads/file1.json",
                            type: "Patient",
                        },
                    ],
                    error: [],
                },
            });

            // Simulate 404 for downloads/file1.json with some response headers
            mockServer.mock("/downloads/file1.json", {
                status: 404,
                body: "",
                headers: { "x-debugging-header": "someValue" },
            });

            const { log } = await invoke();
            const entry = Utils.getLogEvent(log, "download_error");
            expect(entry).to.exist();
            expect(entry.eventDetail.fileUrl).to.equal(
                mockServer.baseUrl + "/downloads/file1.json",
            );
            expect(entry.eventDetail.body).to.be.undefined();
            expect(entry.eventDetail.duration).to.not.be.undefined();
            expect(entry.eventDetail.message).to.equal(
                `GET ${mockServer.baseUrl}/downloads/file1.json FAILED with 404 and message Not Found.`,
            );
            expect(entry.eventDetail.responseHeaders).to.be.object();
            expect(entry.eventDetail.responseHeaders).to.include({
                "x-debugging-header": "someValue",
            });
        });

        it("retries downloading even if initial download fails", async () => {
            mockServer.mock("/metadata", { status: 200, body: {} });

            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                {
                    status: 200,
                    headers: {
                        "content-location": mockServer.baseUrl + "/status",
                    },
                },
            );

            mockServer.mock("/status", {
                status: 200,
                headers: { "content-type": "application/json" },
                body: {
                    transactionTime: new Date().toISOString(),
                    output: [
                        {
                            url: mockServer.baseUrl + "/downloads/file1.json",
                            type: "Patient",
                        },
                    ],
                    error: [],
                },
            });

            let numTries = 0;
            mockServer.mock("/downloads/file1.json", {
                handler(req, res) {
                    numTries += 1;
                    // Simulate 502 for downloads/file1.json with some response headers
                    if (numTries <= 1) {
                        res.status(502);
                        res.set("x-debugging-header", "someValue");
                        res.end("");
                    } else {
                        // Succeed on the second request
                        res.status(200);
                        res.set("x-debugging-header", "someValue");
                        res.set("content-type", "application/fhir+ndjson");
                        res.set("Content-Disposition", "attachment");
                        res.end('{"resourceType":"Patient"}\n{"resourceType":"Patient"}');
                    }
                },
            });

            const { log } = await invoke();
            const entries = Utils.getLogEvents(log, "download_request");
            expect(
                entries.length,
                'download_request should be logged twice for "/downloads/file1.json"',
            ).to.equal(2);
            expect(entries[0].eventDetail.fileUrl).to.equal(
                mockServer.baseUrl + "/downloads/file1.json",
            );
            expect(entries[0].eventDetail.itemType).to.equal("output");
            // Evidence of Failure
            expect(numTries).to.equal(2);
        });
    });
});
