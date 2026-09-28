import { BatchWriteCommand, type BatchWriteCommandOutput, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

type DeleteKey = { PK: string; SK: string };
type DeleteRequest = { DeleteRequest: { Key: DeleteKey } };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deletes keys in batches of 25, resending whatever DynamoDB returned in
 * UnprocessedItems. A throttled BatchWrite is a partial delete; reporting the
 * original count after one shot is how a reset can claim success and leave
 * rows behind.
 */
export async function batchDeleteKeys(
  doc: DynamoDBDocumentClient,
  tableName: string,
  keys: DeleteKey[],
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<void> {
  if (keys.length === 0) return;
  const maxAttempts = options.maxAttempts ?? 8;
  const baseDelayMs = options.baseDelayMs ?? 100;

  for (let i = 0; i < keys.length; i += 25) {
    let pending: DeleteRequest[] = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 1; pending.length > 0 && attempt <= maxAttempts; attempt++) {
      const result: BatchWriteCommandOutput = await doc.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: pending } }),
      );
      pending = (result.UnprocessedItems?.[tableName] ?? []) as DeleteRequest[];
      if (pending.length > 0 && attempt < maxAttempts && baseDelayMs > 0) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
    if (pending.length > 0) {
      throw new Error(
        `DynamoDB left ${pending.length} unprocessed delete requests after ${maxAttempts} attempts.`,
      );
    }
  }
}
