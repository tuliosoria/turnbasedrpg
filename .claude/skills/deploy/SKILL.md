---
name: deploy
description: Use when deploying Valdren to production - backend (SAM) and/or frontend (Amplify). Enforces the full sequence including the steps that get forgotten.
---

# Deploy do Valdren

Dois passos independentes, **manuais**, sem CI. Foram feitos umas dez vezes à mão
nesta campanha, e as duas falhas foram sempre as mesmas: deployar sem commitar, e
deployar o backend esquecendo o frontend.

## A sequência, inteira

Não pule etapa por achar que a mudança é pequena. As duas falhas acima
aconteceram justamente em mudanças pequenas.

### 1. Antes de qualquer deploy

```bash
npm run build:shared          # obrigatório se mexeu em shared/
npm run typecheck             # tsc --noEmit nos três pacotes
npx vitest run --root backend | grep -E "Tests |FAIL"
npx vitest run --root shared  | grep -E "Tests "
npx vitest run --root frontend | grep -E "Tests |FAIL"
```

`vitest` **não** faz typecheck. Rodar só os testes deixa erro de tipo passar.
O script `typecheck` da raiz é o atalho: `tsc --noEmit` em `shared`, `backend`
e `frontend`.

### 2. Commitar ANTES de deployar

```bash
git status --short          # tem que estar limpo depois do commit
git add -A && git commit    # mensagem seguindo o estilo do repositório
git push origin main
```

Deployar código não commitado significa que produção roda algo que não existe no
histórico. Já aconteceu: a correção que fez as cartas ficarem boas ficou meia hora
no ar sem commit.

### 3. Backend (SAM)

`npm run deploy:backend` reconstrói as Lambda layers (`backend/layers/` é
gitignored — sharp nativo + imagens de seed) **antes** de `sam deploy`. Sem
isso o SAM empacota diretório vazio e o worker de imagem quebra em produção.
Se as layers continuarem faltando depois do script, o comando falha na hora.

```bash
npm run deploy:backend
aws cloudformation describe-stacks --region us-east-1 --stack-name ravenloft-winter \
  --query "Stacks[0].StackStatus" --output text     # tem que dar UPDATE_COMPLETE
```

### 4. Frontend (Amplify) — o passo esquecido

O Amplify **não** está ligado ao repositório. Não existe build automático no push:
se você não subir o zip, o site continua com a versão anterior.

```bash
set -euo pipefail
npm run build --workspace frontend
cd frontend/dist
rm -f /tmp/site.zip
zip -qr /tmp/site.zip .
R=$(aws amplify create-deployment --region us-east-1 --app-id d1emmrcvmpw55g --branch-name main --output json)
JOB=$(echo "$R" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["jobId"]);open("/tmp/upurl","w").write(d["zipUploadUrl"])')
code=$(curl -s -X PUT -T /tmp/site.zip "$(cat /tmp/upurl)" -o /dev/null -w "%{http_code}") || true
printf 'upload %s\n' "$code"
case "$code" in
  2[0-9][0-9]) ;;
  *) exit 1 ;;
esac
aws amplify start-deployment --region us-east-1 --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB"
while true; do
  status=$(aws amplify get-job --region us-east-1 --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB" --query 'job.summary.status' --output text)
  case "$status" in
    SUCCEED) break ;;
    FAILED|CANCELLED) printf '%s\n' "$status"; exit 1 ;;
    *) sleep 15 ;;
  esac
done
```

### 5. Verificar que está no ar

```bash
curl -s -o /dev/null -w "site %{http_code}\n" https://valdrenrpg.com/
```

Se mexeu num worker, confirme que ele existe com o handler certo:

```bash
aws lambda list-functions --region us-east-1 \
  --query "Functions[?contains(FunctionName,'Worker')].[FunctionName,Handler,Timeout]" --output table
```

## Quando o deploy quebra a regra de CORS

A allowlist de origem é do **gateway**, não da Lambda. Vive em `AllowedOrigin`, que
é `Type: CommaDelimitedList` — `!Split` dentro de `CorsConfiguration` não funciona,
o SAM passa a string inteira como um item só e bloqueia todas as origens.

## Só o backend mudou?

Então só o passo 3. Mas **rode o passo 1 mesmo assim** e **commite mesmo assim**.
