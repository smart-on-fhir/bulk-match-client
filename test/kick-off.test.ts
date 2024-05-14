import { expect } from "@hapi/code";
import { BulkMatchClient as Types } from "..";
import { BulkMatchClient } from "../src/client";
import baseSettings from "../src/default-config";
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
        } as Types.NormalizedOptions);
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
        const expectedUrl = "http://example.com";
        setTimeout(() => {
            mockServer.clear();
            mockServer.mock("/metadata", { status: 200, body: {} });
            mockServer.mock(
                { method: "post", path: "/Patient/\\$bulk-match" },
                { status: 200, body: "Success", headers: { "content-location": expectedUrl } },
            );
        }, waitTime * 500);
        const client = new BulkMatchClient({
            ...baseSettings,
            fhirUrl: mockServer.baseUrl,
        } as Types.NormalizedOptions);
        const url = await client.kickOff();
        expect(url).to.equal(expectedUrl);
    });
});

describe("status", () => {
    describe("complete", () => {
        it.skip("returns the manifest", async () => {
            mockServer.mock("/status", {
                status: 200,
                body: { output: [{}] },
                headers: { "content-type": "application/json" },
            });
            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            } as Types.NormalizedOptions);
            await client.waitForMatch(mockServer.baseUrl + "/status");
            // TODO add a manifest
        });
    });

    describe("error", () => {
        it("throws an error when the endpoint responds with a 400", async () => {
            mockServer.mock("/status", { status: 400 });

            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            } as Types.NormalizedOptions);

            await expect(client.waitForMatch(mockServer.baseUrl + "/status")).reject(
                Error,
                `GET ${mockServer.baseUrl}/status FAILED with 400 and message Bad Request.`,
            );
        });
    });
});
