import { describe, it, expect, beforeEach } from "vitest";
import { savePlayerSession, loadPlayerSession, clearPlayerSession } from "./playerSession";

describe("playerSession", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadPlayerSession()).toBeNull();
  });

  it("round-trips a saved session", () => {
    savePlayerSession({ playerToken: "t1", houseId: "vargen", displayName: "Elira" });
    expect(loadPlayerSession()).toEqual({
      playerToken: "t1",
      houseId: "vargen",
      displayName: "Elira",
    });
  });

  it("clears the session", () => {
    savePlayerSession({ playerToken: "t1", houseId: "vargen", displayName: "Elira" });
    clearPlayerSession();
    expect(loadPlayerSession()).toBeNull();
  });
});
