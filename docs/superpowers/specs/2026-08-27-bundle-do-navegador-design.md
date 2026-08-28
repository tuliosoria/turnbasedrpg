# O navegador para de baixar o que nunca usa

Data: 2026-08-27

## 1. O problema

O site entrega **um único arquivo de 1466 kB (463 kB comprimido)** para todo
mundo que abre qualquer página. Dentro dele viaja o painel do Mestre, a
enciclopédia, o Estúdio e — o mais estranho — um motor de jogo falso completo
que nenhum jogador real vai executar.

A partida é jogada por turnos, uma vez por semana. O Mestre e as três Casas
voltam ao site toda semana, e a cada deploy o navegador deles joga fora o
arquivo inteiro e baixa 463 kB de novo, mesmo quando o que mudou foi uma frase.

Nada disso é escolha de desenho. É o que sobra de um build que ninguém afinou —
e, como a §2.1 mostra, de um build que **não podia** ser afinado.

## 2. Os quatro achados

Todos medidos, nenhum estimado.

### 2.1 `vite.config.ts` é um arquivo morto

`frontend/tsconfig.node.json` tem `composite: true` e inclui `vite.config.ts`.
Projeto composto é obrigado a emitir, então `tsc -b` cospe um `vite.config.js`
ao lado do `.ts`. E o Vite, na ordem de resolução dele, **prefere o `.js`**.

```
vite:config using resolved config: {
  configFile: '/Users/jessicarosa/turnbasedrpg/frontend/vite.config.js',
```

O arquivo compilado está no `.gitignore`, então existe só na máquina de quem
buildou — e é dessa máquina que saem os deploys. As duas versões hoje têm o
mesmo conteúdo, então nada quebrou ainda. Mas qualquer pessoa que tentasse
afinar o build editaria o `.ts`, veria o bundle sair idêntico, e concluiria que
o Vite não sabe fazer aquilo. Foi exatamente o que aconteceu comigo: gastei três
experimentos achando que `manualChunks` não funcionava.

Este achado vem primeiro porque **os outros três dependem dele**. Sem resolver a
sombra, a configuração de chunks da §2.4 não teria efeito nenhum.

**Correção:** dar um `outDir` fora da árvore de fontes ao `tsconfig.node.json`,
para o artefato do `tsc` não cair mais em cima da configuração de verdade.

### 2.2 O motor falso do jogo vai para produção

`frontend/src/api/index.ts` importa os dois clientes estaticamente e escolhe um
em tempo de execução:

```ts
import { MockApiClient } from "./mockClient";
import { HttpApiClient } from "./httpClient";
export const apiClient: ApiClient =
  baseUrl && baseUrl.length > 0 ? new HttpApiClient(baseUrl) : new MockApiClient();
```

Como a escolha é em tempo de execução, o bundler não tem como provar que o mock
é inalcançável, e o embarca. `mockClient.ts` tem **1507 linhas** — é o maior
arquivo do repositório — e implementa uma campanha inteira em memória: turnos,
cartas, energia, diplomacia, espionagem, cânone. Confirmei no bundle servido em
produção procurando frases que só existem no mock, como
`"Escolha a Casa que será enganada"`.

Em produção `VITE_API_BASE_URL` está preenchida por `.env.production`, e a URL
aparece embutida no bundle servido — então esse código nunca roda. Todo jogador
baixa **250 kB** de um jogo de mentira.

**A correção óbvia não funciona.** Tentei trocar a condição por
`import.meta.env.DEV`, que o Vite substitui por `false` no build de produção, na
esperança de que o ramo morto fosse removido. O bundle saiu com os mesmos
1466 kB e a frase do mock continuou lá: instanciar uma classe importada não é
provadamente livre de efeito colateral, então o Rollup se recusa a descartá-la.
Enquanto o `import` estático existir, o mock viaja.

**A correção que funciona** é tirar o mock do grafo estático e buscá-lo só
quando ele for usado:

```ts
export async function criarApiClient(): Promise<ApiClient> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (baseUrl && baseUrl.length > 0) return new HttpApiClient(baseUrl);
  const { MockApiClient } = await import("./mockClient");
  return new MockApiClient();
}
```

O mock vira um chunk separado de 250 kB que **produção nunca busca** — conferi
que o `index.html` gerado não o pré-carrega. O desenvolvimento offline continua
funcionando igual, só paga uma ida à rede que ninguém sente em `localhost`.

Isso obriga `main.tsx` a esperar a promessa antes de renderizar. Com `await` no
topo do módulo o build falha (`Top-level await is not available in the
configured target environment`), então o desenho usa `.then`. Em produção a
promessa resolve sem buscar nada, então não há atraso perceptível.

Os testes não são afetados: `apiClient` tem **um único consumidor**, o
`main.tsx`, e os 32 arquivos de teste que usam o mock constroem
`new MockApiClient()` diretamente.

### 2.3 As 16 rotas são todas importadas de uma vez

`App.tsx` importa estaticamente as 16 páginas. Das cerca de 12000 linhas de
código da aplicação, **5868 são exclusivas do Mestre** (`AdminPage`, os
componentes de `components/admin`, as abas da enciclopédia). Quem abre a landing
page baixa o Escriba, o Estúdio e o Acervo antes de ver a primeira palavra.

**Correção:** `React.lazy` nas seis páginas pesadas — Admin, Enciclopédia,
Galeria, Canônico, Wiki e Histórias — com um `Suspense` em volta das rotas. As
páginas leves e as de entrada continuam estáticas: quebrar a landing page em
pedaços só adicionaria uma ida à rede antes do primeiro desenho.

### 2.4 React e MUI viajam junto com a aplicação

Sem `manualChunks`, as bibliotecas ficam no mesmo arquivo que o código do jogo.
Elas quase nunca mudam; o código do jogo muda toda semana. Hoje, uma correção de
uma frase invalida os 463 kB inteiros no navegador de quem já tinha tudo em
cache.

**Correção:** `react`/`react-dom`/`react-router-dom` num chunk, `@mui/material`
noutro. O hash deles passa a sobreviver aos deploys.

## 3. O resultado medido

Rodei o estado final combinado antes de escrever esta spec.

| | Primeiro acesso | Volta depois de um deploy |
|---|---|---|
| **Hoje** | 1466 kB · **463 kB** comprimido | **463 kB** — tudo de novo |
| **Depois** | 1108 kB · **346 kB** comprimido | **175 kB** — só o chunk da aplicação |

**−25% no primeiro acesso, −62% na volta.** Os chunks finais:

```
react      163,1 kB · gzip  53,2 kB   (estável entre deploys)
mui        404,1 kB · gzip 117,9 kB   (estável entre deploys)
index      540,5 kB · gzip 174,5 kB   (muda a cada deploy)
AdminPage   79,3 kB · gzip  23,0 kB   (só quem abre /admin)
mockClient 249,9 kB · gzip  85,1 kB   (produção nunca busca)
+ sete rotas menores, de 1,6 a 8 kB cada
```

O caso que mais importa é o da direita. Quatro pessoas voltam a este site toda
semana, e é para elas que 463 kB viram 174 kB.

## 4. O que muda no código

Quatro pontos, nenhum deles tocando em regra de jogo:

1. `frontend/tsconfig.node.json` — `outDir` fora da árvore de fontes, e apagar o
   `vite.config.js` e o `vite.config.d.ts` que sobraram.
2. `frontend/src/api/index.ts` — exporta `criarApiClient()`, que busca o mock
   por `import()` dinâmico só quando não há URL de API; e `frontend/src/main.tsx`
   espera essa promessa com `.then` antes de renderizar.
3. `frontend/src/App.tsx` — `lazy` nas seis páginas pesadas, `Suspense` em volta.
4. `frontend/vite.config.ts` — `manualChunks` para react e MUI.

Nenhuma mudança de comportamento. Nada do que o jogador vê muda; muda o que ele
baixa.

## 5. Como sei que não quebrei nada

O risco real desta mudança não é o bundle sair maior — é uma tela **sumir** de
um jeito que os testes não veem, porque o `lazy` transforma um import em uma
promessa e um erro de resolução só aparece ao navegar.

- **A suíte inteira passa:** 291 shared, 865 backend, 362 frontend. Os testes de
  frontend montam componentes direto, sem passar pelo roteador, então eles
  provam que os componentes continuam íntegros mas **não** provam que as rotas
  resolvem.
- **Um teste novo em `App.test.tsx`** navega até cada uma das seis rotas
  preguiçosas e espera a tela aparecer. É esse teste que fecha o buraco acima.
  Sem ele, um caminho de import errado passaria verde e só quebraria no ar.
- **O modo offline não pode morrer:** um teste sobre `criarApiClient()` garante
  que ela devolve o `HttpApiClient` quando há URL e o `MockApiClient` quando não
  há — que é como o desenvolvimento sem backend funciona.
- **Verificação em produção:** depois do deploy, conferir que a frase exclusiva
  do mock não aparece mais no chunk de entrada, que o `index.html` servido não
  pré-carrega o chunk do mock, e que `/admin`, `/enciclopedia` e `/game` abrem
  no navegador.

O último item é o que de fato importa: esta é uma partida ao vivo, e uma rota
que não abre custa mais do que 300 kB jamais custaram.

## 6. O que não entra agora, e por quê

**A superfície de API definida quatro vezes.** `client.ts` declara 100 métodos,
`httpClient.ts` implementa 101, `mockClient.ts` implementa 104, `router.ts`
registra 106. Um endpoint novo custa quatro arquivos; entender um endpoint custa
quatro leituras. É o maior imposto que este repositório cobra de quem trabalha
nele — inclusive do agente — mas é um problema com outro critério de sucesso e
outro risco: mexer ali é refatorar uma classe de 104 métodos no meio de uma
partida. Merece spec própria, depois desta.

**Tetos nos prompts de IA.** `buildResolutionPrompt`, `buildPrivateInfoPrompt` e
os prompts de projeto não têm orçamento de caracteres, ao contrário do evento
público e do cânone, que têm. Hoje isso não custa nada: são três Casas, e a
crônica já é limitada por `CHRONICLE_MAX_TURNS`. O que cresce sem teto é o
número de ordens por turno, que é três. Resolver agora seria consertar um
problema que não existe.

**Quebrar o `mockClient` em módulos por domínio.** Faz sentido pelo custo de
leitura, não pelo do jogador — depois da §2.2 ele deixa de pesar no navegador.
Entra junto com a spec da superfície de API, se ela acontecer.
