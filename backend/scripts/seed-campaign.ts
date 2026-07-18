import { campaign } from "@ravenloft/content";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient } from "../src/db/dynamo";
import { campaignPk, turnPk } from "../src/keys";

async function main() {
  const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
  const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
  const doc = makeDocClient(process.env.AWS_REGION ?? "us-east-1");

  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: "META", campaignId, activeTurnId: campaign.activeTurnId },
    }),
  );
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: turnPk(campaignId, campaign.activeTurnId), SK: "META", turnStatus: "OPEN" },
    }),
  );
  console.log(`Seeded campaign ${campaignId} into ${tableName}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
