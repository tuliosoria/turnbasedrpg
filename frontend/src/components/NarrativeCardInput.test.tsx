import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Attributes, CardResponse, NarrativeCard } from "@ravenloft/content";
import { NarrativeCardInput } from "./NarrativeCardInput";

const attributes: Attributes = { riqueza: 4, recursos: 2, soldados: 1, controle: 3 };

const spendCard: NarrativeCard = {
  id: "guard",
  title: "Vigília Congelada",
  constraintText: "O que permite vigiar a estrada",
  narrativeQuestion: "Quem enfrentará a neve?",
  consequenceText: "A estrada cobrará seu preço.",
  spend: { attribute: "soldados", max: 3 },
};

const choiceCard: NarrativeCard = {
  id: "stores",
  title: "Celeiros sob Gelo",
  constraintText: "O que permite alimentar os famintos",
  narrativeQuestion: "Qual força sustenta o povo?",
  consequenceText: "A escolha deixará uma dívida.",
  choice: { attributes: ["riqueza", "recursos"], amount: 1 },
};

describe("NarrativeCardInput", () => {
  it("renders a spend stepper capped by house attributes", () => {
    render(
      <NarrativeCardInput
        card={spendCard}
        houseAttributes={attributes}
        value={{ cardId: "guard", text: "", declaredSpend: { attribute: "soldados", amount: 1 } }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("O que permite vigiar a estrada")).toBeInTheDocument();
    expect(screen.getByText("Quem enfrentará a neve?")).toBeInTheDocument();
    expect(screen.getByText("A estrada cobrará seu preço.")).toBeInTheDocument();
    expect(screen.getByText("Gastar até 1 de soldados")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aumentar gasto/i })).toBeDisabled();
  });

  it("incrementing a spend card emits declaredSpend", async () => {
    const onChange = vi.fn();
    render(
      <NarrativeCardInput
        card={spendCard}
        houseAttributes={{ ...attributes, soldados: 2 }}
        value={{ cardId: "guard", text: "vigiar", declaredSpend: { attribute: "soldados", amount: 0 } }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /aumentar gasto/i }));

    expect(onChange).toHaveBeenCalledWith({
      cardId: "guard",
      text: "vigiar",
      declaredSpend: { attribute: "soldados", amount: 1 },
    });
  });

  it("renders choice radios", () => {
    render(
      <NarrativeCardInput
        card={choiceCard}
        houseAttributes={attributes}
        value={{ cardId: "stores", text: "" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "riqueza" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "recursos" })).toBeInTheDocument();
  });

  it("typing the narrative answer emits text", async () => {
    const onChange = vi.fn();
    const value: CardResponse = { cardId: "stores", text: "", declaredChoice: { attribute: "riqueza" } };
    function StatefulInput() {
      const [current, setCurrent] = useState(value);
      return (
        <NarrativeCardInput
          card={choiceCard}
          houseAttributes={attributes}
          value={current}
          onChange={(next) => {
            setCurrent(next);
            onChange(next);
          }}
        />
      );
    }

    render(<StatefulInput />);

    await userEvent.type(screen.getByLabelText(/resposta narrativa/i), "O povo dividirá o pão.");

    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      text: "O povo dividirá o pão.",
    });
  });
});
