---
name: mexer-em-prompt-de-carta
description: Use when changing how NPC letters are written in Valdren - any edit to housePrompt, outreachPrompt, revisor, voice, crise, estagio, leitura, escala or lados. Enforces measuring the accumulated rule count before and after, because adding rules is how this system broke four times.
---

# Mexer num prompt de carta

Este sistema já quebrou **quatro vezes pelo mesmo motivo**: alguém somou uma regra
para consertar uma falha, e a soma das regras virou um formulário.

```
carta vazia  → "toda carta precisa de movimento concreto"
             → tudo virou escambo
             → "seja concreto no que o assunto pedir"
             → prazo em 17 de 18 cartas
             → o jogador disse que parecia robô

carta melosa → "cordial não é o padrão"
             → todo Valdren virou o mesmo diplomata rancoroso
```

Nenhuma dessas regras era burra isolada. O dano estava na soma, e a soma não
aparece quando você lê o diff.

## As três perguntas, antes de escrever qualquer coisa

**1. Dá para TIRAR em vez de somar?** A falha que você quer consertar costuma vir
de outra regra que já está lá. Procure a regra que causou antes de escrever a que
compensa.

**2. Isto é fiscalização?** Se a regra é "isto não pode faltar" ou "isto nunca pode
aparecer", ela pertence ao **revisor** (`revisor.ts`), que lê a carta pronta. No
escritor ela só consegue adivinhar antes de existir texto, e o preço de adivinhar
é engessar toda carta.

**3. Vale para os dois caminhos?** Resposta (`housePrompt`) e carta proativa
(`outreachPrompt`) são prompts diferentes. Uma regra escrita só num deles **vai**
falhar no outro — foi assim que a Ferrumor repetiu, na carta proativa, exatamente o
erro que a regra de estágio consertava na resposta. Regra compartilhada mora no
próprio módulo (`estagio.ts`, `leitura.ts`, `crise.ts`) e é importada pelos dois.

## Medir antes

```bash
cat > backend/_conta.mjs <<'JS'
import { HOUSE_REPLY_SYSTEM_PROMPT } from "./src/ai/diplomacy/housePrompt";
import { OUTREACH_SYSTEM_PROMPT } from "./src/ai/diplomacy/outreachPrompt";
for (const [n,p] of [["resposta",HOUSE_REPLY_SYSTEM_PROMPT],["proativa",OUTREACH_SYSTEM_PROMPT]]) {
  const l = p.split("\n").filter(x => x.trim().length > 25);
  const o = l.filter(x => /\bTODA\b|\bSEMPRE\b|\bNUNCA\b|\bprecisa\b|\bdeve\b|\bexij/.test(x));
  console.log(`${n}: ${l.length} regras | ${o.length} obrigatórias | ${p.length} chars`);
}
JS
npx esbuild backend/_conta.mjs --bundle --platform=node --target=node20 --format=esm \
  --outfile=backend/_c.mjs --external:sharp \
  --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"
node backend/_c.mjs; rm -f backend/_conta.mjs backend/_c.mjs
```

Anote os três números. Referência medida em 13/09/2026, depois da reforma:

| | resposta | proativa |
|---|---|---|
| regras | 46 | 41 |
| obrigatórias | 7 | 5 |
| chars | 9.189 | 7.650 |

Para comparação, o pior momento — quando o Mestre disse que parecia robô — foi
**52 regras e 9 obrigações**. As duas obrigações que voltaram depois da reforma
("responda a pergunta que fizeram antes de qualquer outra coisa" e a de português
falado) foram acréscimos conscientes para consertar hostilidade. É exatamente esse
tipo de subida que precisa de justificativa.

## Medir depois

Rode de novo. **Se o número de obrigações subiu, você precisa justificar em voz
alta por que essa é a exceção** — ou mover a regra para o revisor.

## Provar num caso real, antes de deployar

Contagem não prova qualidade. Rode a mesma carta pelo prompt velho e pelo novo, e
compare o texto. O caso canônico desta campanha é o convite de Durgan a Ferrumor:
um pedido de **encontro**, que por muito tempo voltava como minuta com preço mínimo
por seis meses.

Monte um script temporário em `backend/` que importe de `./src/...`, empacote com
`esbuild --bundle`, e puxe a chave assim:

```bash
FN=$(aws lambda list-functions --region us-east-1 \
  --query "Functions[?starts_with(FunctionName,'ravenloft-winter-ApiFunction')].FunctionName" --output text)
eval "$(aws lambda get-function-configuration --region us-east-1 --function-name $FN \
  --query "Environment.Variables" --output json | python3 -c '
import json,sys
v=json.load(sys.stdin)
for k in ("OPENAI_API_KEY","OPENAI_DIPLOMACY_MODEL"):
    if v.get(k): print(f"export {k}={json.dumps(v[k])}")')"
```

**A chave nunca vai para arquivo.** Apague o script temporário quando terminar.

Pontos a olhar no texto, nesta ordem:
1. A primeira frase responde o que foi perguntado?
2. Tem prazo em dias? Se sim, ele era necessário?
3. Alguém diz "não sei", tem medo, ou discorda de si mesmo?
4. Você diria essas frases em voz alta para alguém na sua frente?

## Testes

Os testes de prompt checam a **regra**, não a redação. Se você reformulou uma regra
e um teste quebrou pela frase exata, conserte o teste para o conceito — mas se ele
quebrou porque a regra **sumiu**, é o teste que está certo.

Depois: `npx vitest run --root backend` e a skill `deploy`.
