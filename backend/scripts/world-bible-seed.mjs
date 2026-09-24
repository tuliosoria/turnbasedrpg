// Default World Bible for a new Valdren campaign.
// Used by reset-campaign.mjs (full reset) and seed-world-bible.mjs.

export const SEED_LORE = `Valdren é um reino-ilha de fantasia política e horror sobrenatural, cercado por uma muralha de Brumas. Mede cerca de 560 quilômetros de norte a sul e 340 na maior largura — aproximadamente o tamanho da Inglaterra. Ao sul, o oceano termina nas Brumas; ao norte, montanhas e geleiras fecham o caminho. Perto de dois milhões de pessoas vivem em cidades, fortalezas, aldeias e comunidades isoladas: humanos, elfos, anões, orcs, gnomos, draconatos e outros povos. Magia existe, mas é rara, ritual e politicamente controlada.

A capital é Asterhall, no Vale da Coroa, às margens do Rio Valen, no encontro das Cinco Estradas Reais. A Casa Real é Valerius. O rei Edric III morreu; Lady Celene Valerius governa como regente de Alic Valerius, herdeiro de doze anos. O reino não é um império: depende das Grandes Casas para grãos, metal, crédito, estradas, soldados e magia. Cada jogador lidera uma Grande Casa.

O Norte está em silêncio. Rimewatch deixou de responder. Aldeias foram abandonadas. Refugiados chegaram a Stonebridge com relatos de cadáveres caminhando na neve. O inverno chegou cedo. Valdren ainda não declarou guerra, mas já deixou de acreditar que enfrenta apenas bandidos.

Cada Casa possui quatro atributos, de 0 a 5:
- Riqueza: dinheiro, comércio e capacidade de contratar serviços.
- Recursos: alimentos, madeira, ferro, cavalos e suprimentos.
- Soldados: força militar e capacidade de defender o território.
- Controle: capacidade institucional de executar decisões.

Cada jogador começa com 10 pontos para distribuir entre os quatro atributos. Nenhum atributo pode começar acima de 5.

Exemplo — Casa Vargen:
Sede: Droskar, nas Marcas do Norte. Especialidade: defesa e conhecimento do terreno frio. Fraqueza: poucos grãos e terras pouco produtivas; depende do sul para alimento. Riqueza 1, Recursos 2, Soldados 5, Controle 2 (total 10).

Em cada turno, as Casas recebem um evento e informações privadas. Os jogadores escrevem o que desejam fazer. As decisões criam a história e geram consequências. Os atributos são RESTRIÇÕES, não ações: eles limitam o que é plausível.`;

export const SEED_VISUAL_DIRECTIVES = `# Diretrizes para Geração e Evolução de Imagens

Além de criar a narrativa da campanha, você também é responsável por manter a identidade visual do mundo. Sempre que um turno produzir um acontecimento importante, determine quais imagens devem ser geradas ou editadas. O objetivo não é apenas ilustrar o texto, mas mostrar visualmente que Valdren está mudando ao longo da campanha.

# Estilo Artístico
Todas as imagens devem compartilhar o mesmo estilo: dark fantasy gótico medieval, pintura digital cinematográfica, muito detalhada, tons frios, atmosfera pesada, neve, névoa e iluminação dramática, consistência entre personagens, cidades e arquitetura. Nunca altere drasticamente o estilo entre imagens.

# Prioridade
Sempre que possível, edite imagens existentes em vez de criar novas. O mundo deve parecer contínuo. Se um castelo foi criado no Turno 1, ele deve continuar sendo o mesmo castelo no Turno 8. Mantenha: arquitetura, posição da câmera, composição, personagens e identidade visual. Altere apenas o necessário para refletir os acontecimentos.

# Elementos permanentes
Manter uma imagem-base para: mapa de Valdren, cada Grande Casa, brasão de cada Casa, castelo principal de cada Casa, principais cidades, Rei Branco, NPCs importantes, artefatos lendários e fortalezas do Norte. Sempre reutilizar essas imagens como base para futuras edições.

# Evolução Visual
O mundo deve mudar conforme a campanha.
- Castelos: adicionar muralhas destruídas, neve, fumaça, bandeiras rasgadas, reconstruções, cercos, catapultas, refugiados. Nunca gerar um castelo completamente diferente.
- Cidades: mostrar crescimento, fome, incêndios, epidemias, reconstrução, mercados, soldados, barricadas, ocupação pelos mortos.
- Mapa: editar continuamente cidades conquistadas, fortalezas destruídas, avanço das Brumas, avanço do inverno, novas estradas, áreas abandonadas, regiões dominadas pelo Rei Branco.
- Personagens: os retratos devem evoluir (barba crescendo, cicatrizes, armaduras danificadas, envelhecimento, sinais de exaustão, roupas de luto, coroas, novas armas). Sempre preservar identidade facial.
- Brasões: podem ganhar cicatrizes, rachaduras, símbolos conquistados, coroas, espadas, manchas de sangue, fitas de luto.

# Imagens de Resultado dos Turnos
Após resolver cada turno, avalie se existe um acontecimento digno de ilustração. Priorize eventos de grande impacto narrativo: queda de uma fortaleza, grande batalha, morte de um líder, cidade incendiada, chegada dos mortos, vitória heroica, sacrifício, coroação, descoberta de ruínas, pacto sombrio, avanço das Brumas. Cada imagem deve representar exatamente o resultado do turno.

## Exemplo 1
Evento: Os mortos avançam sobre a Estrada Branca rumo a Stonebridge. A Casa Vargen envia toda sua guarda para conter o avanço. Eles conseguem atrasar o exército morto por um dia, permitindo a evacuação dos refugiados, mas praticamente toda a força militar é destruída.
Imagem: Vista cinematográfica da estrada coberta de neve nas Marcas do Norte. Soldados da Casa Vargen formando a última linha de defesa. Bandeiras dos lobos rasgadas pelo vento. Milhares de mortos avançando. Refugiados atravessando ao fundo rumo a Stonebridge. Última resistência desesperada. Atmosfera sombria.

## Exemplo 2
Evento: Asterhall celebra uma falsa vitória enquanto o Norte inteiro já caiu.
Imagem: Grande salão iluminado. Nobres comemorando. Ao fundo, um mensageiro coberto de neve entra pelas portas carregando uma bandeira destruída. O contraste deve transmitir tragédia iminente.

## Exemplo 3
Evento: Uma cidade aceita um acordo com o Rei Branco.
Imagem: Moradores ajoelhados diante de um antigo rei envolto por névoa. Nenhum combate. A atmosfera deve transmitir um pacto inevitável.

# Quando NÃO gerar imagens
Não gerar imagens para eventos pequenos: pequenas negociações, movimentação econômica comum, pequenas mudanças de atributos, decisões administrativas sem impacto visual. Apenas registrar esses acontecimentos na narrativa.

# Objetivo
Ao final da campanha, um jogador deve conseguir percorrer a galeria de imagens e acompanhar visualmente toda a história de Valdren. As imagens devem parecer páginas ilustradas de uma crônica medieval, mostrando como o reino mudou ao longo dos turnos. Cada imagem deve transmitir emoção, consequência e continuidade, não apenas ilustrar um evento isolado.`;
