import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  newVisualEntity,
  isCanonWikiSection,
  type CanonProposal,
  type WikiEntry,
} from "@ravenloft/content";
import { createHash } from "node:crypto";
import { putWikiEntry } from "../db/wiki";
import { putEntity, listEntities } from "../db/visual/entities";
import { slugify } from "../validation/visualSchemas";

export interface EscribaDeps {
  doc: DynamoDBDocumentClient;
  tableName: string;
  campaignId: string;
}

// Mesmo alfabeto que `generateWikiId` usa, para os ids derivados não destoarem
// dos que já estão no banco.
const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Id estável derivado da chave da operação.
 *
 * É o que torna republicar inofensivo: a mesma chave produz a mesma chave
 * primária, então a segunda escrita reescreve a primeira em vez de criar um
 * registro irmão. Sem isso, uma resposta perdida no meio do caminho fazia o
 * Mestre publicar de novo e duplicar cânone numa partida ao vivo.
 */
function idEstavel(semente: string, tamanho = 10): string {
  const hash = createHash("sha256").update(semente).digest();
  let id = "";
  for (let i = 0; i < tamanho; i++) id += ALFABETO[hash[i] % ALFABETO.length];
  return id;
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
  /**
   * Chave da tentativa de publicação, gerada na tela e mantida até dar certo.
   * Duas chamadas com a mesma chave escrevem o mesmo cânone, não dois.
   */
  opId: string;
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
    entryId: idEstavel(`verbete:${entrada.opId}`),
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
    const entityId = idEstavel(`entidade:${entrada.opId}`, 16);
    const existentes = await listEntities(doc, tableName, campaignId);
    let slug = slugify(proposal.canonicalName);
    // A própria entidade de uma tentativa anterior não conta como colisão: se
    // contasse, cada retentativa mudaria o slug e o endereço do personagem na
    // Enciclopédia mudaria sozinho. O sufixo também é derivado da chave, para
    // não variar entre tentativas.
    if (existentes.some((e) => e.slug === slug && e.id !== entityId)) {
      slug = `${slug}-${idEstavel(`slug:${entrada.opId}`, 4)}`;
    }

    const entity = newVisualEntity({
      id: entityId,
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
      "O verbete foi gravado, mas a entidade não. Publicar de novo é seguro e completa o que faltou.",
      entry.entryId,
      err,
    );
  }
}
