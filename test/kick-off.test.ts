import baseSettings from "../config/defaults.js";
import { BulkMatchClient } from "../src/client";
import { mockServer } from "./lib";

describe("kick-off", () => {
    it("Makes a patient-level match by default", async () => {
        mockServer.mock("/metadata", { status: 200, body: {} });
        mockServer.mock(
            { method: "post", path: "/Patient/\\$bulk-match" },
            { status: 202, body: "", headers: { "content-location": "x" } },
        );
        const client = new BulkMatchClient({
            ...baseSettings,
            fhirUrl: mockServer.baseUrl,
        });
        await client.kickOff();
    });
    it("Waits if Kickoff results in a 429, then retry", async () => {
        // In seconds
        const waitTime = 1;
        mockServer.mock("/metadata", { status: 200, body: {} });
        mockServer.mock(
            { method: "post", path: "/Patient/\\$bulk-match" },
            {
                status: 429,
                body: { issue: [{ severity: "information" }] },
                headers: { "Retry-after": String(waitTime), "content-type": "application/json" },
            },
        );
        // A risky race-condition, but let's hope this works
        setTimeout(() => {
            mockServer.clear();
            mockServer.mock("/metadata", { status: 200, body: {} });
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 200, body: "Success", headers: { "content-location": "x" } },
            );
        }, waitTime * 500);
        const client = new BulkMatchClient({
            ...baseSettings,
            fhirUrl: mockServer.baseUrl,
        });
        await client.kickOff();
    });
});

describe.skip("status", () => {
    describe("complete", () => {
        it("returns the manifest", async () => {
            mockServer.mock("/status", { status: 200, body: { output: [{}] } });
            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            });
            await client.waitForMatch(mockServer.baseUrl + "/status");
        });
    });

    describe("error", () => {
        it("throws the error", async () => {
            mockServer.mock("/status", { status: 400 });

            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            });

            await client.waitForMatch(mockServer.baseUrl + "/status").then(
                () => {
                    throw new Error("The test should have failed");
                },
                () => {
                    // Error was expected so we are good to go
                },
            );
        });
    });
});
