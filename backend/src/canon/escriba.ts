import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  newVisualEntity,
  isCanonWikiSection,
  type CanonProposal,
  type WikiEntry,
} from "@ravenloft/content";
import { putWikiEntry, generateWikiId } from "../db/wiki";
import { putEntity, listEntities } from "../db/visual/entities";
import { slugify } from "../validation/visualSchemas";

export interface EscribaDeps {
  doc: DynamoDBDocumentClient;
  tableName: string;
  campaignId: string;
  newId: () => string;
}

export interface EntradaDoEscriba {
  proposal: CanonProposal;
  /**
   * Casa dona do que está sendo escrito, ou null.
   *
   * Vem do seletor da tela, nunca de `proposal.houseId`: aquele campo é texto
   * livre da IA, que não conhece os ids sorteados das Casas e devolve o nome
   * ("Vargen") onde o banco espera o id ("vargen-x1"). O Mestre não tem Casa de
   * sessão de onde tirar isso, então ele escolhe — e escolhe "nenhuma" para o
   * muito que escreve que não pertence a Casa alguma.
   */
  houseId: string | null;
}

export interface CanoneEscrito {
  wikiEntryId: string;
  /** Null quando a proposta não pede entidade própria. */
  visualEntityId: string | null;
}

/**
 * Falha depois de o verbete já estar gravado.
 *
 * Carrega o `wikiEntryId` de propósito: o conserto de um verbete sem entidade
 * já existe na interface — o botão "Criar entidade visual" do Acervo — e a tela
 * só consegue apontar para lá se souber qual verbete sobreviveu.
 */
export class ErroDeEscrita extends Error {
  constructor(
    message: string,
    readonly wikiEntryId: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ErroDeEscrita";
  }
}

// Mesma ordem que a publicação de submissões usa: piso alto o bastante para
// cair depois do conteúdo curado sem recalcular as ordens existentes.
const WIKI_APPEND_ORDER = 999;

/**
 * Escreve cânone direto, a partir de texto: um verbete da Enciclopédia e, se a
 * proposta pedir, a entidade que faz dele um personagem, lugar ou objeto.
 *
 * É o miolo do Escriba, a ferramenta de autoria do Mestre. Não passa por
 * `CanonSubmission` porque submissão modela um pedido aguardando julgamento, e
 * o Mestre é o juiz — além de `CanonSubmission.houseId` não ser anulável, o que
 * obrigaria a arquivar o texto do Mestre sob uma Casa jogadora, onde apareceria
 * na lista de propostas de um jogador que não o escreveu.
 *
 * Nunca toca em imagem. Essa é a razão de existir da ferramenta.
 */
export async function escreverCanone(
  deps: EscribaDeps,
  entrada: EntradaDoEscriba,
): Promise<CanoneEscrito> {
  const { doc, tableName, campaignId } = deps;
  const { proposal } = entrada;

  // Mesma barreira de ficção da publicação de submissões: seções fora do cânone
  // são regras de mesa e não recebem verbete de autoria. O Mestre edita essas
  // pela Bíblia, que é a porta delas.
  if (!isCanonWikiSection(proposal.section)) {
    throw new Error(
      `Seção "${proposal.section}" é fora do cânone e não pode receber texto do Escriba.`,
    );
  }

  const entry: WikiEntry = {
    entryId: generateWikiId(),
    section: proposal.section,
    title: proposal.title,
    body: proposal.body,
    order: WIKI_APPEND_ORDER,
    updatedAt: new Date().toISOString(),
  };
  await putWikiEntry(doc, tableName, campaignId, entry);

  if (proposal.entityType === null) {
    return { wikiEntryId: entry.entryId, visualEntityId: null };
  }

  try {
    const existentes = await listEntities(doc, tableName, campaignId);
    let slug = slugify(proposal.canonicalName);
    if (existentes.some((e) => e.slug === slug)) slug = `${slug}-${deps.newId().slice(0, 4)}`;

    const entity = newVisualEntity({
      id: deps.newId(),
      campaignId,
      entityType: proposal.entityType,
      canonicalName: proposal.canonicalName,
      slug,
      publicDescription: proposal.summary,
      immutableTraits: proposal.immutableTraits,
      wikiEntryId: entry.entryId,
      houseId: entrada.houseId,
    });
    entity.status = "CANONICAL";
    await putEntity(doc, tableName, campaignId, entity);

    return { wikiEntryId: entry.entryId, visualEntityId: entity.id };
  } catch (err) {
    throw new ErroDeEscrita(
      "O verbete foi gravado, mas a entidade não. Use \u201cCriar entidade visual\u201d no Acervo para completar.",
      entry.entryId,
      err,
    );
  }
}
