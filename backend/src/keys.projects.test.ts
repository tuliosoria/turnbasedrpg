import { describe, it, expect } from "vitest";
import { projectSk, projectHousePrefix, projectPrefix, favorSk, favorHousePrefix } from "./keys";

describe("project/favor keys", () => {
  it("builds project SK", () => {
    expect(projectSk("casa-abcd", "p1")).toBe("PROJECT#casa-abcd#p1");
  });
  it("builds project house prefix", () => {
    expect(projectHousePrefix("casa-abcd")).toBe("PROJECT#casa-abcd#");
  });
  it("builds project prefix", () => {
    expect(projectPrefix()).toBe("PROJECT#");
  });
  it("builds favor SK and prefix", () => {
    expect(favorSk("casa-abcd", "f1")).toBe("FAVOR#casa-abcd#f1");
    expect(favorHousePrefix("casa-abcd")).toBe("FAVOR#casa-abcd#");
  });
});
