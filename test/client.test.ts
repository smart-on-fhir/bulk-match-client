/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from "@hapi/code";
import { readFileSync } from "fs";
import path from "path";
import baseSettings from "../config/defaults.js";
import { BulkMatchClient } from "../src/client";

describe("client testing", function () {
  describe("BulkMatchClient", function () {
    let client: unknown;
    this.beforeAll(() => {
      client = new BulkMatchClient({
        ...baseSettings,
      });
    });
    describe("_parseResourceStringOption", function () {
      it("Should work on valid JSON strings", () => {
        const resourceString = `{"key": "value"}`;
        // @ts-expect-error
        const resource = (client as BulkMatchClient)._parseResourceStringOption(
          resourceString,
        );
        expect(resource).to.equal(JSON.parse(resourceString));
      });
      it("Should work on absolute path to valid JSON objects", () => {
        // Dynamically build abs path based on machine's CWD
        const resourcePathAbsolute = path.join(
          process.cwd() + "/test/fixtures/resource-obj.json",
        );
        const resourceFixture = JSON.parse(
          readFileSync(resourcePathAbsolute, "utf8"),
        );
        // @ts-expect-error
        const resource = (client as BulkMatchClient)._parseResourceStringOption(
          resourcePathAbsolute,
        );
        expect(resource).to.equal(resourceFixture);
      });
      it("Should work on relatives path, relative-to where the command is invoked", () => {
        // Paths must be relative to the client itself
        const resourcePathRelative = "./test/fixtures/resource-obj.json";
        const resourceFixture = JSON.parse(
          readFileSync(path.resolve(resourcePathRelative), "utf8"),
        );
        // @ts-expect-error
        const resource = (client as BulkMatchClient)._parseResourceStringOption(
          resourcePathRelative,
        );
        expect(resource).to.equal(resourceFixture);
      });
      it("Should work on JSON Arrays", () => {
        // With inline text
        const resourceArray = `[{"key": "value"}]`;
        // @ts-expect-error
        const r1 = (client as BulkMatchClient)._parseResourceStringOption(
          resourceArray,
        );
        expect(r1).to.equal(JSON.parse(resourceArray));

        // With Fixtures
        const resourcePathRelativeArray = "./test/fixtures/resource-array.json";
        const resourceFixtureArray = JSON.parse(
          readFileSync(path.resolve(resourcePathRelativeArray), "utf8"),
        );
        // @ts-expect-error
        const r2 = (client as BulkMatchClient)._parseResourceStringOption(
          resourcePathRelativeArray,
        );
        expect(r2).to.equal(resourceFixtureArray);
      });
      it.skip("Should throw when path is invalid", () => {});
      it.skip("Should throw when path does not parse as json", () => {});
    });
  });
});
