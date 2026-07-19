import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HouseForm, type HouseFormValue } from "./HouseForm";

function baseValue(): HouseFormValue {
  return {
    name: "Casa Teste",
    motto: "Lema",
    emblem: { icon: "lobo", color1: "#7f1d1d", color2: "#1e3a5f" },
    leaderName: "Líder",
    heirName: "Herdeiro",
    castleName: "Castelo",
    townsText: "Vilas",
    historyText: "História",
    specialty: "Especialidade",
    weakness: "Fraqueza",
    attributes: { riqueza: 1, recursos: 1, soldados: 1, controle: 1 },
  };
}

describe("HouseForm", () => {
  it("emits updated name via onChange", async () => {
    const onChange = vi.fn();
    render(<HouseForm value={baseValue()} onChange={onChange} section="identity" />);

    await userEvent.type(screen.getByLabelText(/nome da casa/i), "X");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Casa TesteX" }));
  });

  it("in free mode has no points budget label and allows raising attributes freely", async () => {
    const onChange = vi.fn();
    render(<HouseForm value={baseValue()} onChange={onChange} section="attributes" attributeMode="free" />);

    expect(screen.queryByText(/pontos restantes/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /aumentar riqueza/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ attributes: expect.objectContaining({ riqueza: 2 }) }));
  });

  it("in budget mode shows remaining points", () => {
    render(<HouseForm value={baseValue()} onChange={vi.fn()} section="attributes" attributeMode="budget" />);
    expect(screen.getByText(/pontos restantes/i)).toBeInTheDocument();
  });
});
