import { expect } from "@hapi/code";
import { BulkMatchClient as Types } from "..";
import { BulkMatchClient } from "../src/client";
import baseSettings from "../src/default-config";
import MockServer from "./lib/MockServer";

describe("kick-off", function () {
    const mockServer = new MockServer("MockServer", true);
    // Set longer timeout
    this.timeout(10000);

    // Start/stop/refresh mock server
    before(async () => await mockServer.start());
    after(async () => await mockServer.stop());
    afterEach(() => mockServer.clear());

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
        const waitTime = 3;
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
