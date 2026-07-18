import { describe, it, expect } from "vitest";
import { parseClaimBody, parseLoginBody, parseChoiceBody, parseAdminLoginBody } from "./schemas";
import { HttpError } from "../types/domain";

describe("validation", () => {
  it("parses a valid claim body", () => {
    expect(parseClaimBody({ houseId: "vargen", displayName: "Elira" })).toEqual({
      houseId: "vargen",
      displayName: "Elira",
    });
  });

  it("rejects an unknown houseId", () => {
    expect(() => parseClaimBody({ houseId: "nope", displayName: "X" })).toThrow(HttpError);
  });

  it("rejects a missing displayName", () => {
    expect(() => parseClaimBody({ houseId: "vargen" })).toThrow(/displayName/);
  });

  it("parses login and choice and admin bodies", () => {
    expect(parseLoginBody({ playerCode: "vargen-4K7P" })).toEqual({ playerCode: "vargen-4K7P" });
    expect(parseChoiceBody({ cardId: "vargen-defend-bridge" })).toEqual({ cardId: "vargen-defend-bridge" });
    expect(parseAdminLoginBody({ adminCode: "secret" })).toEqual({ adminCode: "secret" });
  });

  it("rejects non-object bodies", () => {
    expect(() => parseLoginBody(null)).toThrow(HttpError);
    expect(() => parseChoiceBody("x")).toThrow(HttpError);
  });
});
