import { expect } from "@hapi/code";
import { BulkMatchClient as Types } from "..";
import { BulkMatchClient } from "../src/client";
import baseSettings from "../src/default-config";
import { RequestError } from "../src/lib/errors";
import MockServer from "./lib/MockServer";
describe("status", function () {
    const mockServer = new MockServer("MockServer", true);

    // Set longer timeout
    this.timeout(10000);

    // Start/stop/refresh mock server
    before(async () => await mockServer.start());
    after(async () => await mockServer.stop());
    afterEach(() => mockServer.clear());

    describe("complete", () => {
        it("returns the manifest", async () => {
            mockServer.mock("/status", {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: { output: [{}] },
            });
            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            } as Types.NormalizedOptions);
            const m = await client.waitForMatch(mockServer.baseUrl + "/status");
            expect(m).to.be.an.object();
            expect(m.output).to.be.an.array();
        });
    });

    describe("error", () => {
        it("throws an error when the endpoint responds with a 400", async () => {
            mockServer.mock("/status", { status: 400 });

            const client = new BulkMatchClient({
                ...baseSettings,
                fhirUrl: mockServer.baseUrl,
            } as Types.NormalizedOptions);

            const err = await expect(client.waitForMatch(mockServer.baseUrl + "/status")).to.reject(
                RequestError,
                `GET ${mockServer.baseUrl}/status FAILED with 400 and message Bad Request.`,
            );
            expect(err.status).to.equal(400);
        });
    });
});
