/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from "@hapi/code";
import { readFileSync } from "fs";
import { readdir } from "fs/promises";
import path from "path";
import baseSettings from "../config/template-config.js";
import { BulkMatchClient } from "../src/client";
import { Errors } from "../src/lib";
import { Utils } from "./lib/";

describe("client testing", function () {
    describe("BulkMatchClient", function () {
        let client: BulkMatchClient;
        this.beforeAll(() => {
            client = new BulkMatchClient({
                ...baseSettings,
            });
        });
        describe("_parseResourceNdjson", function () {
            it("Should work on NDJSON ", () => {
                const ndjsonExample = Utils.getFixture("patients.ndjson");
                const interiorJson = ndjsonExample.split("\n").map((j) => JSON.parse(j));
                // @ts-expect-error
                expect(client._parseResourceNdjson(ndjsonExample)).to.equal(interiorJson);
            });
            it("Should throw on non-NDJSON ", () => {
                const regularJson = { key: "value" };
                // @ts-expect-error
                expect(() => client._parseResourceNdjson(regularJson)).throws(
                    "Attempted parsing of [object Object] as ndjson led to the following error: resource.split is not a function. Without a valid resource, we cannot proceed",
                );
            });
        });
        describe("_parseResourceStringOption", function () {
            it("Should work on valid JSON strings", async () => {
                const resourceStringObj = `{"key": "value"}`;
                const resourceStringArray = `[{"key": "value"}]`;
                const resourceObj =
                    // @ts-expect-error
                    await client._parseResourceStringOption(resourceStringObj);
                const resourceArr =
                    // @ts-expect-error
                    await client._parseResourceStringOption(resourceStringArray);
                expect(resourceObj).to.equal(JSON.parse(resourceStringObj));
                expect(resourceArr).to.equal(JSON.parse(resourceStringArray));
            });
            it("Should work on absolute path to valid JSON objects", async () => {
                // Dynamically build abs path based on machine's CWD
                const resourcePathAbsolute = path.join(
                    process.cwd(),
                    "test/fixtures/patient-obj.json",
                );
                const resourceFixture = JSON.parse(readFileSync(resourcePathAbsolute, "utf-8"));
                const resource =
                    // @ts-expect-error
                    await client._parseResourceStringOption(resourcePathAbsolute);
                expect(resource).to.equal(resourceFixture);
            });
            it("Should work on relatives path, relative-to where the command is invoked", async () => {
                // Paths must be relative to where the command is invoked itself
                const resourcePathRelative = path.resolve("./test/fixtures/patient-obj.json");
                const resourceFixture = JSON.parse(readFileSync(resourcePathRelative, "utf-8"));
                const resource =
                    // @ts-expect-error
                    client._parseResourceStringOption(resourcePathRelative);
                expect(await resource).to.equal(resourceFixture);
            });
            it("Should work on a directory of JSON", async () => {
                const dir = path.resolve("./test/fixtures/jsonDir");
                const files = await Promise.all(
                    (await readdir(dir)).map((file) =>
                        JSON.parse(readFileSync(path.join(dir, file), "utf-8")),
                    ),
                );
                const resource =
                    // @ts-expect-error
                    client._parseResourceStringOption(dir);
                expect(await resource).to.equal(files);
            });
            it("Should work on an NDJSON file", async () => {
                const ndjsonPath = path.resolve("./test/fixtures/patients.ndjson");
                const ndjson = readFileSync(ndjsonPath, "utf-8");
                const finalJson = ndjson.split("\n").map((j) => JSON.parse(j));
                // @ts-expect-error
                expect(await client._parseResourceStringOption(ndjsonPath)).to.equal(finalJson);
            });
            it("Should throw when path is invalid", async () => {
                const invalidPath = "./some/path";
                // @ts-expect-error
                await expect(client._parseResourceStringOption(invalidPath)).reject(
                    Errors.UnknownResourceStringError,
                    `Attempted parsing of ./some/path as a resource led to the following error: Unexpected token '.', "./some/path" is not valid JSON. Without a valid resource, we cannot proceed`,
                );
            });
            it("Should throw when file at path does not parse as json", async () => {
                const invalidFile = "./test/fixtures/not-json.txt";
                // @ts-expect-error
                await expect(client._parseResourceStringOption(invalidFile)).reject(
                    Errors.UnknownResourceStringError,
                    `Attempted parsing of ./test/fixtures/not-json.txt as a resource led to the following error: Unexpected extension type of .txt. Without a valid resource, we cannot proceed`,
                );
            });
            it("Should throw when the stringifies JSON is invalid", async () => {
                const invalidStringifiedJson = "{not:valid}";
                await expect(
                    // @ts-expect-error
                    client._parseResourceStringOption(invalidStringifiedJson),
                ).reject(
                    Errors.UnknownResourceStringError,
                    `Attempted parsing of {not:valid} as a resource led to the following error: Expected property name or '}' in JSON at position 1 (line 1 column 2). Without a valid resource, we cannot proceed`,
                );
            });
        });
        describe("_parseResourceOption", function () {
            it("Should work on valid strings, wrapping the return value in an array", async () => {
                const resourceStringObj = `{"key": "value"}`;
                const resourceStringArray = `[{"key": "value"}]`;
                const resourcePathRelative = path.resolve("./test/fixtures/patient-obj.json");
                const resourcePathFixture = JSON.parse(readFileSync(resourcePathRelative, "utf-8"));
                const resourceObj =
                    // @ts-expect-error
                    await client._parseResourceOption(resourceStringObj);
                const resourceArr =
                    // @ts-expect-error
                    await client._parseResourceOption(resourceStringArray);
                const resourceFile =
                    // @ts-expect-error
                    await client._parseResourceOption(resourcePathRelative);
                expect(resourceObj).to.equal([JSON.parse(resourceStringObj)]);
                expect(resourceArr).to.equal(JSON.parse(resourceStringArray));
                expect(resourceFile).to.equal([resourcePathFixture]);
            });
            it("Should work on valid inline JSON Arrays", async () => {
                const resourceArr = [{ key: "value" }];
                const parsedArr =
                    // @ts-expect-error
                    await client._parseResourceOption(resourceArr);
                // @ts-expect-error
                expect(parsedArr).to.equal(resourceArr);
            });
            it("Should wrap valid inline JSON objects in arrays when returning", async () => {
                const resourceObj = { key: "value" };
                const parsedObj =
                    // @ts-expect-error
                    await client._parseResourceOption(resourceObj);
                // @ts-expect-error
                expect(parsedObj).to.equal([resourceObj]);
            });
        });
    });
});
