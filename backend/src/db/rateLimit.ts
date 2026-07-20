import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { rateLimitPk } from "../keys";

/**
 * Atomically increments the counter for `bucketKey` in the current fixed-length
 * window and returns the resulting count. Items carry a DynamoDB `ttl` (epoch
 * seconds) so they self-expire after the window ends.
 */
export async function hitRateLimit(
  doc: DynamoDBDocumentClient,
  tableName: string,
  bucketKey: string,
  windowSeconds: number,
  nowMs: number = Date.now(),
): Promise<number> {
  const windowStart = Math.floor(nowMs / (windowSeconds * 1000));
  const ttl = (windowStart + 1) * windowSeconds;
  const res = await doc.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: rateLimitPk(bucketKey), SK: `W#${windowStart}` },
    UpdateExpression: "ADD #count :one SET #ttl = :ttl",
    ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
    ExpressionAttributeValues: { ":one": 1, ":ttl": ttl },
    ReturnValues: "UPDATED_NEW",
  }));
  return (res.Attributes?.count as number | undefined) ?? 1;
}
