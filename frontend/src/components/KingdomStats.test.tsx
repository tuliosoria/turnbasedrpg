import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KingdomStats } from "./KingdomStats";

const state = {
  provisions: 6, militaryStrength: 5, unity: 5,
  publicOrder: 6, enemyKnowledge: 0, undeadAdvance: 1,
};

describe("KingdomStats", () => {
  it("renders all six indicators with values out of 10", () => {
    render(<KingdomStats state={state} />);
    expect(screen.getByText("Provisões")).toBeInTheDocument();
    expect(screen.getByText("Avanço dos Mortos")).toBeInTheDocument();
    expect(screen.getByText("6 / 10")).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });
});
