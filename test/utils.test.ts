/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from "@hapi/code";
import { BulkMatchClient as Types } from "../";
import {
  filterResponseHeaders,
  getAccessTokenExpiration,
} from "../src/lib/utils";

describe("Utils Library", function () {
  describe("filterExportHeaders", () => {
    it("returns undefined if headers is undefined or null", () => {
      // @ts-expect-error
      expect(filterResponseHeaders(undefined)).to.equal(undefined);
      // @ts-expect-error
      expect(filterResponseHeaders(null)).to.equal(undefined);
    });
    it("returns an empty object if selectedHeaders is an empty array", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
      });
      expect(filterResponseHeaders(headers, [])).to.equal({});
    });
    it("returns an empty object if selectedHeaders's headers are not found", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
      });
      expect(filterResponseHeaders(headers, ["header3"])).to.equal({});
    });
    it("finds matching headers given strings in selectedHeaders", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
      });
      const headersAsObject = Object.fromEntries(headers);
      expect(filterResponseHeaders(headers, ["header"])).to.equal({
        header: "value",
      });
      expect(filterResponseHeaders(headers, ["header2"])).to.equal({
        header2: "value2",
      });
      // Handles multiple options well
      expect(filterResponseHeaders(headers, ["header", "header2"])).to.equal(
        headersAsObject,
      );
    });
    it("finds matching headers given regexps in selectedHeaders", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
      });
      const headersAsObject = Object.fromEntries(headers);
      expect(filterResponseHeaders(headers, [new RegExp("header.*")])).to.equal(
        headersAsObject,
      );
      // NOTE: Partial match is still a match against both keys
      expect(filterResponseHeaders(headers, [/header/])).to.equal(
        headersAsObject,
      );
      expect(filterResponseHeaders(headers, [new RegExp("header")])).to.equal(
        headersAsObject,
      );
      // Expecting an additional character, only matches our second header
      expect(filterResponseHeaders(headers, [new RegExp("header.+")])).to.equal(
        {
          header2: "value2",
        },
      );
      // Handles multiple regexp fine
      expect(
        filterResponseHeaders(headers, [
          new RegExp("header2"),
          new RegExp("header$"),
        ]),
      ).to.equal(headersAsObject);
      // Correctly handles cases of no matching
      expect(filterResponseHeaders(headers, [new RegExp("footer.+")])).to.equal(
        {},
      );
    });
    it("finds matching headers if selectedHeaders contains a mix of strings and RegExp ", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
        new: "string",
        footer: "random",
      });
      const headersAsObject = Object.fromEntries(headers);
      expect(
        filterResponseHeaders(headers, [
          "new",
          new RegExp("header"),
          new RegExp("foot.*"),
        ]),
      ).to.equal(headersAsObject);
      expect(
        filterResponseHeaders(headers, ["newish", new RegExp("footer.+")]),
      ).to.equal({});
    });
    it("uses case-insensitive checks for string matching", () => {
      const headers = new Headers({
        header: "value",
        header2: "value2",
        new: "string",
        footer: "random",
      });
      // SelectedHeader is case-insensitive
      expect(filterResponseHeaders(headers, ["HEADER"])).to.equal({
        header: "value",
      });
    });
  });
  describe("getAccessTokenExpiration", () => {
    // real-time calcs are finicky, we can be off by a second or two
    const delta = 2;
    let now: number;
    this.beforeEach(() => {
      now = Math.floor(Date.now() / 1000);
    });
    it("Returns a time based on expires_in, if defined ", () => {
      const tokenResponse = { expires_in: 5 } as Types.TokenResponse;
      expect(getAccessTokenExpiration(tokenResponse))
        .to.be.greaterThan(now + tokenResponse.expires_in! - delta)
        .to.be.lessThan(now + tokenResponse.expires_in! + delta);
    });
    it("Returns a time based on the decoded access_token, if no expires_in ", () => {
      const tokenResponse = {
        access_token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYmVhcmVyIiwic2NvcGUiOiJzeXN0ZW0vUGF0aWVudC5ycyIsImNsaWVudF9pZCI6ImV5SmhiR2NpT2lKSVV6STFOaUlzSW5SNWNDSTZJa3BYVkNKOS5leUpxZDJ0eklqcDdJbXRsZVhNaU9sdDdJbXQwZVNJNklrVkRJaXdpWTNKMklqb2lVQzB6T0RRaUxDSjRJam9pTTBzeFRIYzNVV3RxYWpWTVYxTnJOVTV1U1hkWGJXdGlOVmx2TWtkclkzZFdkRzVOT0hob2FFZGtUVEJpU1ROQ05qTXlVVTFhYlhGMFVraFJOVUZRU2lJc0lua2lPaUpEUW5GcGNUVlJkMFU0UlhsVmVIY3lYMjlFU25wV1NISlpOV295TW01NU9VdGlVa05MTlhaQlFuQndZVWRQTkhnNFRYaHVWRmRtVVUxMFIwbGlWbEZPSWl3aWEyVjVYMjl3Y3lJNld5SjJaWEpwWm5raVhTd2laWGgwSWpwMGNuVmxMQ0pyYVdRaU9pSmlNemRtWTJZd1lqVTRNREZtWkdVellXWTBPR0prTlRWbVpEazFNVEUzWlNJc0ltRnNaeUk2SWtWVE16ZzBJbjFkZlN3aVlXTmpaWE56Vkc5clpXNXpSWGh3YVhKbFNXNGlPakUxTENKbVlXdGxUV0YwWTJobGN5STZNQ3dpWkhWd2JHbGpZWFJsY3lJNk1Dd2laWEp5SWpvaUlpd2liV0YwWTJoVFpYSjJaWElpT2lJaUxDSnRZWFJqYUZSdmEyVnVJam9pSWl3aWFXRjBJam94TnpFek9EQTVNall3ZlEuclFuNzBPell0enFCR0ZwR01yVmlIMUtlWm9MZkVVTmJ0UF9ldUtzbmNyTSIsImV4cGlyZXNfaW4iOjkwMCwiaWF0IjoxNzE0MTY0OTIwLCJleHAiOjE3MTQxNjU4MjB9.7SKvcpJKc9UoNFF1Bi27Q8PtoqHLXTUWNe6DEsJIcTA",
      } as Types.TokenResponse;
      // Static value from the above JWT
      const expTime = 1714165820;
      expect(getAccessTokenExpiration(tokenResponse)).to.equal(expTime);
    });
    it("Returns a time 5 minutes from now if no expires_in or access_token ", () => {
      expect(getAccessTokenExpiration({} as Types.TokenResponse))
        .to.be.greaterThan(now + 300 - delta)
        .to.be.lessThan(now + 300 + delta);
    });
    it("Returns a time 5 minutes from now if the access token is poorly formatted", () => {
      const tokenResponse = {
        access_token: "poorly-formatted-token",
      } as Types.TokenResponse;
      expect(getAccessTokenExpiration(tokenResponse))
        .to.be.greaterThan(now + 300 - delta)
        .to.be.lessThan(now + 300 + delta);
    });
  });
});
