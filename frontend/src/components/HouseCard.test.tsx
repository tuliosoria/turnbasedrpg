import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HouseCard } from "./HouseCard";

const house = {
  id: "vargen" as const,
  name: "Casa Vargen",
  subtitle: "Os Lobos do Norte",
  motto: "Primeiro a muralha.",
  strength: "Exército experiente.",
  available: true,
};

describe("HouseCard", () => {
  it("shows name, subtitle and an available action", async () => {
    const onSelect = vi.fn();
    render(<HouseCard house={house} onSelect={onSelect} />);
    expect(screen.getByText("Casa Vargen")).toBeInTheDocument();
    expect(screen.getByText("Os Lobos do Norte")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /disponível/i }));
    expect(onSelect).toHaveBeenCalledWith("vargen");
  });

  it("disables the button and shows 'Escolhida' when unavailable", () => {
    render(<HouseCard house={{ ...house, available: false }} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /escolhida/i })).toBeDisabled();
  });
});
