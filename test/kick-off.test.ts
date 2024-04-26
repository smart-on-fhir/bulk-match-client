import baseSettings from "../config/defaults.js";
import { BulkMatchClient } from "../src/client";
import { mockServer } from "./lib";

describe("kick-off", () => {
  it("makes a patient-level match by default", async () => {
    mockServer.mock("/metadata", { status: 200, body: {} });
    mockServer.mock(
      { method: "post", path: "/Patient/\\$bulk-match" },
      { status: 202, body: "", headers: { "content-location": "x" } },
    );
    // @ts-ignore
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
      // @ts-ignore
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

      // @ts-ignore
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
