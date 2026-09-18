import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, bookSk, bookPrefix } from "../keys";
import { BOOK_PART_IDS, DEFAULT_BOOK_CHAPTERS, type BookChapter, type BookStatus } from "@ravenloft/content";

export interface BookChapterInput {
  part: string;
  order: number;
  title: string;
  body: string;
  status: BookStatus;
}

function toChapter(item: Record<string, unknown>): BookChapter {
  return {
    chapterId: typeof item.chapterId === "string" ? item.chapterId : "",
    part: typeof item.part === "string" ? item.part : "",
    order: typeof item.order === "number" ? item.order : 0,
    title: typeof item.title === "string" ? item.title : "",
    body: typeof item.body === "string" ? item.body : "",
    status: item.status === "rascunho" || item.status === "publicado" ? item.status : "rascunho",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function sortChapters(chapters: BookChapter[]): BookChapter[] {
  const partIndex = (id: string) => {
    const i = BOOK_PART_IDS.indexOf(id);
    return i === -1 ? BOOK_PART_IDS.length : i;
  };
  return chapters.sort((a, b) => {
    const pa = partIndex(a.part);
    const pb = partIndex(b.part);
    if (pa !== pb) return pa - pb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Deriva um chapterId estável a partir do título: slug + sufixo curto. O sufixo
 * evita colisão quando dois capítulos nascem do mesmo título no editor.
 */
export function generateBookId(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "capitulo";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${slug}-${suffix}`;
}

export async function listBookChapters(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<BookChapter[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": bookPrefix() },
    }),
  );
  return sortChapters((res.Items ?? []).map(toChapter));
}

export async function putBookChapter(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  chapter: BookChapter,
): Promise<BookChapter> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: bookSk(chapter.chapterId), ...chapter },
    }),
  );
  return chapter;
}

export async function deleteBookChapter(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  chapterId: string,
): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: bookSk(chapterId) } }),
  );
}

/**
 * Semeia o romance a partir do manuscrito compilado, mas só quando o livro
 * está vazio. Preserva o chapterId estável de cada capítulo, para que uma
 * edição no editor volte a bater com o mesmo arquivo em livro/. Retorna quantos
 * capítulos foram semeados (0 se já existirem), então é seguro chamar de novo.
 */
export async function seedDefaultBook(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<{ seeded: number }> {
  const existing = await listBookChapters(doc, tableName, campaignId);
  if (existing.length > 0) return { seeded: 0 };

  const now = new Date().toISOString();
  for (const def of DEFAULT_BOOK_CHAPTERS) {
    await putBookChapter(doc, tableName, campaignId, {
      chapterId: def.chapterId,
      part: def.part,
      order: def.order,
      title: def.title,
      body: def.body,
      status: def.status,
      updatedAt: now,
    });
  }
  return { seeded: DEFAULT_BOOK_CHAPTERS.length };
}
