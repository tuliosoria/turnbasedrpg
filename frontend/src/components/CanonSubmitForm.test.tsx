import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanonSubmitForm } from "./CanonSubmitForm";
import type { CanonProposal, CanonReview } from "@ravenloft/content";

const TITULO = "Sera de Vargen";
const TEXTO =
  "Batedora das fronteiras do Norte, conhecida por atravessar o Muro dos Ausentes sozinha em pleno inverno.";

/**
 * A IA classifica, mas nunca devolve prosa. Se um dia devolver, o formulário
 * ignora — e é isto que estes testes protegem.
 */
const proposal: CanonProposal = {
  title: TITULO,
  section: "casas",
  body: TEXTO,
  summary: "",
  entityType: "CHARACTER",
  canonicalName: TITULO,
  immutableTraits: [],
  houseId: null,
};

const review: CanonReview = { verdict: "OK", flags: [], conflictingEntryIds: [] };

function setup(over: Partial<React.ComponentProps<typeof CanonSubmitForm>> = {}) {
  const props = {
    onAdvice: vi.fn(async () => ({ proposal, review })),
    onSubmit: vi.fn(async () => {}),
    onUploadImage: vi.fn(async () => ({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" })),
    ...over,
  };
  render(<CanonSubmitForm {...props} />);
  return props;
}

async function escrever(titulo = TITULO, texto = TEXTO) {
  await userEvent.type(screen.getByLabelText(/^título$/i), titulo);
  await userEvent.type(screen.getByLabelText(/o verbete/i), texto);
}

async function escolherSecao() {
  await userEvent.click(screen.getByLabelText(/seção/i));
  await userEvent.click(await screen.findByRole("option", { name: /casas/i }));
}

describe("o texto é do jogador", () => {
  // A queixa que originou a mudança: a IA transformava o pedido num verbete e
  // era a versão dela que o jogador enviava, perdendo a voz de quem escreveu.
  it("promete, na tela, que a revisão não altera o texto", () => {
    setup();
    expect(screen.getByText(/não altera o seu texto/i)).toBeInTheDocument();
  });

  it("envia exatamente o que o jogador escreveu", async () => {
    const { onSubmit } = setup();
    await escrever();
    await escolherSecao();
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const enviado = (onSubmit as never as { mock: { calls: any[][] } }).mock.calls[0][0];
    expect(enviado.proposal.title).toBe(TITULO);
    expect(enviado.proposal.body).toBe(TEXTO);
  });

  // Mesmo que o modelo devolva prosa diferente, ela não pode vencer a do autor.
  it("ignora texto que a IA por acaso devolva", async () => {
    const onAdvice = vi.fn(async () => ({
      proposal: { ...proposal, title: "OUTRO TÍTULO", body: "Uma reescrita que ninguém pediu." },
      review,
    }));
    const { onSubmit } = setup({ onAdvice });
    await escrever();
    await userEvent.click(screen.getByRole("button", { name: /revisar com a ia/i }));
    await waitFor(() => expect(onAdvice).toHaveBeenCalled());

    expect(screen.getByLabelText(/o verbete/i)).toHaveValue(TEXTO);
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const enviado = (onSubmit as never as { mock: { calls: any[][] } }).mock.calls[0][0];
    expect(enviado.proposal.body).toBe(TEXTO);
    expect(enviado.proposal.title).toBe(TITULO);
  });

  // Revisar é oferta, não pedágio: quem não quer opinião da IA envia direto.
  it("permite enviar sem nunca pedir revisão", async () => {
    const { onSubmit, onAdvice } = setup();
    await escrever();
    await escolherSecao();
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onAdvice).not.toHaveBeenCalled();
  });
});

describe("o que a revisão mostra", () => {
  it("mostra sugestões sem tocar no texto", async () => {
    const onAdvice = vi.fn(async () => ({
      proposal,
      review: { ...review, suggestions: ["Diga em que inverno isso aconteceu."] },
    }));
    setup({ onAdvice });
    await escrever();
    await userEvent.click(screen.getByRole("button", { name: /revisar com a ia/i }));

    expect(await screen.findByText(/em que inverno isso aconteceu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/o verbete/i)).toHaveValue(TEXTO);
  });

  it("mostra contradição com o cânone como aviso, não como erro", async () => {
    const onAdvice = vi.fn(async () => ({
      proposal,
      review: { verdict: "CONFLICT" as const, conflictingEntryIds: [], flags: [{ severity: "BLOCK" as const, message: "Vargen já tem uma batedora com esse nome." }] },
    }));
    setup({ onAdvice });
    await escrever();
    await userEvent.click(screen.getByRole("button", { name: /revisar com a ia/i }));

    const alerta = await screen.findByText(/já tem uma batedora/i);
    expect(alerta.closest(".MuiAlert-root")?.className).toMatch(/Warning/);
    expect(screen.getByRole("button", { name: /enviar ao mestre/i })).toBeEnabled();
  });

  it("diz claramente quando não há nada a apontar", async () => {
    setup();
    await escrever();
    await userEvent.click(screen.getByRole("button", { name: /revisar com a ia/i }));
    expect(await screen.findByText(/nada a apontar/i)).toBeInTheDocument();
  });
});

describe("o que impede o envio", () => {
  it("exige a seção, e diz isso em vez de só desabilitar", async () => {
    setup();
    await escrever();
    expect(screen.getByRole("button", { name: /enviar ao mestre/i })).toBeDisabled();
    expect(screen.getByText(/escolha a seção antes de enviar/i)).toBeInTheDocument();
  });

  it("não pede revisão de um verbete que ainda não existe", async () => {
    const { onAdvice } = setup();
    await userEvent.type(screen.getByLabelText(/^título$/i), "Só o título");
    expect(screen.getByRole("button", { name: /revisar com a ia/i })).toBeDisabled();
    expect(onAdvice).not.toHaveBeenCalled();
  });

  it("diz que a imagem é opcional", async () => {
    setup();
    expect(screen.getByRole("button", { name: /anexar imagem \(opcional\)/i })).toBeInTheDocument();
  });
});
