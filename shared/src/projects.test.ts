import { describe, it, expect } from "vitest";
import { PROJECT_CATEGORIES, PROJECT_STATUSES, isProjectCategory } from "./projects.js";

describe("project enums", () => {
  it("lists 8 categories", () => {
    expect(PROJECT_CATEGORIES).toHaveLength(8);
    expect(PROJECT_CATEGORIES).toContain("MILITARY");
    expect(PROJECT_CATEGORIES).toContain("MAGIC");
  });
  it("includes lifecycle statuses", () => {
    expect(PROJECT_STATUSES).toContain("ACTIVE");
    expect(PROJECT_STATUSES).toContain("PENDING_GM");
    expect(PROJECT_STATUSES).toContain("COMPLETED");
  });
  it("validates category strings", () => {
    expect(isProjectCategory("MILITARY")).toBe(true);
    expect(isProjectCategory("BANANA")).toBe(false);
  });
});
