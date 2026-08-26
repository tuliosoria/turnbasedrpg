import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanonSubmitForm } from "./CanonSubmitForm";
import type { CanonProposal, CanonReview } from "@ravenloft/content";

const proposal: CanonProposal = {
  title: "Sera de Vargen",
  section: "casas",
  body: "Batedora das fronteiras.",
  summary: "Batedora.",
  entityType: "CHARACTER",
  canonicalName: "Sera de Vargen",
  immutableTraits: [],
  houseId: "vargen",
};

const review: CanonReview = { verdict: "OK", flags: [], conflictingEntryIds: [] };

function setup(over: Partial<React.ComponentProps<typeof CanonSubmitForm>> = {}) {
  const props = {
    onPreview: vi.fn(async () => ({ proposal, review })),
    onSubmit: vi.fn(async () => {}),
    onUploadImage: vi.fn(async () => ({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" })),
    ...over,
  };
  render(<CanonSubmitForm {...props} />);
  return props;
}

describe("o convite de imagem", () => {
  /**
   * A imagem sempre foi opcional no pipeline, mas a tela não dizia isso, e o
   * Mestre chegou a pedir uma ferramenta nova por achar que faltava a porta que
   * já existia. O rótulo é a correção.
   */
  it("diz que a imagem é opcional e que o texto basta", async () => {
    await setup();
    expect(screen.getByRole("button", { name: /Anexar imagem \(opcional\)/ })).toBeTruthy();
    expect(screen.getByText(/O texto sozinho já basta/)).toBeTruthy();
  });
});

describe("CanonSubmitForm", () => {
  it("keeps the submit button hidden until there is a preview", () => {
    setup();
    expect(screen.queryByRole("button", { name: /enviar ao mestre/i })).toBeNull();
  });

  it("asks for a preview and shows the proposal for editing", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Quero criar Sera.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith("Quero criar Sera."));
    expect(await screen.findByDisplayValue("Sera de Vargen")).toBeTruthy();
    expect(screen.getByRole("button", { name: /enviar ao mestre/i })).toBeTruthy();
  });

  it("submits the edited proposal", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Quero criar Sera.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    const titleField = await screen.findByDisplayValue("Sera de Vargen");
    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Sera, a Batedora");
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    const sent = vi.mocked(props.onSubmit).mock.calls[0][0];
    expect(sent.proposal.title).toBe("Sera, a Batedora");
    expect(sent.rawImageUrl).toBeNull();
  });

  it("shows the review flags returned by the model", async () => {
    const conflictReview: CanonReview = {
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o cerco." }],
      conflictingEntryIds: [],
    };
    setup({
      onPreview: vi.fn(async () => ({ proposal, review: conflictReview })),
    });
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));
    expect(await screen.findByText(/Contradiz o cerco\./)).toBeTruthy();
  });

  it("um conflito não vira erro fatal: sem alerta vermelho, com aviso e envio liberado", async () => {
    const conflictReview: CanonReview = {
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o nome do líder." }],
      conflictingEntryIds: ["w1"],
    };
    const props = setup({
      onPreview: vi.fn(async () => ({ proposal, review: conflictReview })),
    });
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Troque o nome do líder.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    // A flag aparece, mas como aviso — nunca como erro vermelho fatal.
    expect(await screen.findByText(/Contradiz o nome do líder\./)).toBeTruthy();
    expect(document.querySelector(".MuiAlert-standardError")).toBeNull();
    expect(document.querySelector(".MuiAlert-standardWarning")).toBeTruthy();

    // Linha explícita: conflito não impede o envio; o Mestre decide.
    expect(screen.getByText(/não impede.*envio.*Mestre/i)).toBeTruthy();

    // E o envio funciona, carregando o parecer para o Mestre.
    const submit = screen.getByRole("button", { name: /enviar ao mestre/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    const sent = vi.mocked(props.onSubmit).mock.calls[0][0];
    expect(sent.review).toEqual(conflictReview);
  });

  it("refuses to ask for a preview with an empty text", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));
    expect(props.onPreview).not.toHaveBeenCalled();
  });

  it("stays honest and submittable when the AI critique is unavailable", async () => {
    const props = setup({
      onPreview: vi.fn(async () => ({ proposal, review: null })),
    });
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Quero criar Sera.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    await screen.findByDisplayValue("Sera de Vargen");
    expect(screen.queryByText(/Parecer da IA:/i)).toBeNull();
    expect(screen.getByText(/Crítica da IA indisponível/i)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    const sent = vi.mocked(props.onSubmit).mock.calls[0][0];
    expect(sent.proposal.title).toBe("Sera de Vargen");
  });
});
