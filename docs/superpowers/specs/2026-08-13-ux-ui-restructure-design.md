# Reestruturação de UX/UI — fatia 1: fundação e home

Data: 2026-08-13

## O problema

O site cresceu por acréscimo. Cada recurso novo ganhou uma rota e um botão na
barra, e ninguém nunca voltou para olhar o conjunto. O resultado é medível:

- `/criar`, `/login`, `/game` e `/admin` não têm entrada em menu nenhum. Um
  jogador novo não consegue entrar na campanha sem receber a URL por fora.
- "Galeria" existe duas vezes com o mesmo nome: rota de topo e aba dentro da
  Enciclopédia.
- As 22 seções da wiki viram uma fileira única de chips e uma lista plana no
  drawer.
- Ferramentas de GM (Acervo, Estúdio, Entidades) convivem com conteúdo de
  jogador dentro de "Enciclopédia", separadas só por um `isAdmin` invisível.

## Decomposição

O pedido cobre quatro frentes independentes. Esta spec trata só da primeira.

- **A. Fundação do design system** — tokens e primitivos.
- **B. Navegação e arquitetura de informação** — os quatro problemas acima.
- **C. Home com hero em vídeo.**
- **D. Rollout nas páginas existentes** — Casas, Casa, Galeria, Enciclopédia,
  wiki, Campanha, Game, Admin.

**Fatia 1 = A + C.** Não se desenha um hero sem fixar tipografia, cor e
movimento, e a home é onde a linguagem se decide. Depois B, depois D.

Consequência aceita: entre esta fatia e a D, páginas que ainda não foram
tratadas herdam os tokens novos e ficam visualmente inconsistentes.

## A. Fundação

**Tipografia.** Sai Marcellus, entra Inter Tight. Interface e corpo em regular;
rótulos, navegação e botões em 700, caixa alta, `letter-spacing: 0.14em` — o
gesto que dá a frieza da referência. Títulos em `clamp(2.5rem, 6vw, 5rem)`,
peso 800, caixa alta. Escala de razão 1.25 em tokens.

Consequência aceita: as ~120 páginas de lore passam a ser lidas em sans-serif.
Neutro ou melhor para leitura em tela, mas muda a sensação da wiki de "livro"
para "site".

**Cor.** Base grafite, texto osso, um acento só.

| token | valor | uso |
|---|---|---|
| `base` | `#0e1013` | fundo |
| `surface` | `#15181c` | cards e painéis |
| `raised` | `#1c2026` | hover / elevado |
| `text` | `#e8e6e1` | corpo |
| `muted` | `#9aa0a6` | secundário |
| `line` | `#262b31` | divisórias |
| `accent` | `#c2323c` | carmesim esfriado |
| `accentDim` | `#8e2029` | pressed, foco |

O acento aparece em três lugares e só neles: botão primário, item ativo de
navegação, link inline. O resto é grafite e osso, para a imagem carregar a
página em vez da cor.

**Espaçamento e movimento.** Escala de 4px nomeada; faixa de conteúdo
`max-width: 1200px`. Transições de 160ms `ease-out`, só opacidade e transform.
Sem parallax.

**Onde mora.** `theme.ts` cresce, em vez de ganhar um irmão — já é o lugar dos
tokens e já é importado por tudo. `frontend/src/design/` recebe os primitivos
novos que o hero exige.

## C. Home

**Hero.** `<video muted loop playsinline autoplay preload="metadata">` cobrindo
a viewport com `object-fit: cover`, sobre `poster`. Três defesas contra o modo
de falha típico:

- `poster` cobre o intervalo até o primeiro quadro e o caso de autoplay negado;
- `prefers-reduced-motion: reduce` não monta o `<video>`, só o poster;
- em viewport estreita o vídeo não é baixado — celular recebe a imagem.

**O vídeo é diurno e claro.** Céu azul, nuvens brancas, floresta verde. A
paleta é grafite quase preto. Sem tratamento, ou o texto fica ilegível ou o véu
mata a arte. O tratamento adotado: `filter: saturate(0.72) brightness(0.62)`
mais um gradiente de baixo para cima de `#0e1013` até transparente e uma
vinheta radial. O topo do quadro continua legível como arte; a base vira fundo
de texto.

**Conteúdo.** Título em caixa alta, uma linha de subtítulo, e dois botões:
**Criar sua Casa** (acento) e **Explorar Valdren** (outline). "Entrar" fica
permanente na barra — é o que resolve as rotas invisíveis para quem já joga.

Abaixo do hero, três blocos curtos: estado da campanha, três Casas em destaque,
e uma porta para a Campanha D&D.

**Os arquivos.** `frontend/public/valdren-hero.mp4` (2,9 MB) e
`valdren-hero-poster.jpg` (86 KB).

O original tinha o átomo `moov` no fim, o que obriga o navegador a baixar os
2,9 MB antes do primeiro quadro. `scripts/mp4-faststart.mjs` move o `moov` para
antes do `mdat` e corrige as 192 entradas de `stco`, sem recodificar e sem
depender de ffmpeg, que não está instalado nesta máquina. Verificado: os
offsets deslocam exatamente os 6910 bytes do `moov`, o arquivo mantém o mesmo
tamanho, e o vídeo decodifica no Chrome.

Não corrigido: o arquivo ainda carrega uma trilha AAC inútil num vídeo mudo.
Remover exigiria remux de verdade, e o ganho é pequeno.

## Testes

- Hero cai para o poster quando o autoplay é negado.
- `prefers-reduced-motion` não monta o `<video>`.
- Os CTAs apontam para `/criar` e `/valdren`; "Entrar" aponta para `/login`.
- Os tokens do tema existem com os valores da tabela acima.
- `mp4-faststart` põe `moov` antes de `mdat`, preserva o tamanho do arquivo e
  desloca os offsets pelo tamanho do `moov`.

## Fora do escopo

Navegação (B) e rollout (D). O drawer, os chips da wiki, a duplicação de
"Galeria" e a separação entre ferramenta de GM e conteúdo de jogador ficam
para a fatia B.
