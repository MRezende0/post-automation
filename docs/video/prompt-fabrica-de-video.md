# Prompt: fábrica de vídeo da Pilar

> Prompt para colar numa sessão do Claude Code aberta neste repo (`post-automation`).
> Objetivo: montar o pipeline que transforma um roteiro em vídeo pronto para aprovação,
> com a UI real da Pilar, a marca da Pilar e imagens geradas e animadas.
> O método (UI real com dado encenado, gravação por screencast, composição em HyperFrames,
> mixagem no ffmpeg) veio do vídeo de demonstração do Precursal. Nenhum script nem asset
> daquele projeto é copiado: são da Labrynth. Aqui tudo é refeito do zero.
> Contexto: `docs/plano-presenca-social.md` §2 e §5, `docs/specs/001-sistema-de-campanha-fase-a.md` (R6).

---

## O prompt

Quero montar a fábrica de vídeo da Pilar dentro deste repo. Não é um vídeo avulso: é um
pipeline reaproveitável que recebe um roteiro e devolve um MP4 pronto para eu aprovar na
plataforma. Os vídeos são em português do Brasil e têm que parecer feitos por uma agência:
ritmo bom, tipografia cuidada, movimento com intenção, áudio limpo.

### Leia antes de começar

1. `docs/plano-presenca-social.md` (formatos, cadência, o que o perfil transmite).
2. `docs/voice.md`, `docs/posicionamento.md`, `docs/brand.md` e, no repo da Pilar,
   `brand/messaging.md`, `brand/visual.md` e `src/styles/tokens.css`.
3. `src/reel.js`: o roteiro que ele gera (`normalizeReelScript`) é a entrada do pipeline.
4. A skill `hyperframes` (entrada obrigatória) e, conforme a etapa, `hyperframes-core`,
   `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-creative`,
   `hyperframes-audio`, `hyperframes-cli`, `hyperframes-registry` e `media-use`.

### Pesquise referências primeiro

Procure na internet vídeos de produto e Reels de SaaS B2B que funcionam: demos de Linear,
Stripe, Notion, Attio, Pitch, Arc, Cron/Notion Calendar e Reels de SaaS brasileiros de
gestão. Escolha 5, assista e escreva em `video/REFERENCIAS.md` o que cada um faz bem
(gancho, ritmo de corte, como mostra a UI, tipografia, transição, fechamento). Depois
diga quais padrões vamos usar e quais descartar. Os vídeos da Vobi e do Sienge servem de
anti-exemplo (feature-dump institucional).

### Formatos que o pipeline precisa produzir

| Tipo | Proporção | Duração | O que mostra |
| --- | --- | --- | --- |
| `reel-tela` | 9:16 | 15 a 30 s | uma tarefa real no Pilar: ver a margem do projeto, preparar um aditivo, o portal do cliente |
| `reel-cinetico` | 9:16 | 10 a 20 s | dor em frases curtas no ritmo da landing ("Projeto estoura prazo. Proposta no feeling. Financeiro descolado."), fecha na tagline |
| `reel-conta` | 9:16 | 20 a 40 s | uma conta de margem na tela (honorário, horas, revisões) que revela o prejuízo escondido |
| `foto-animada` | 4:5 e 9:16 | 6 a 10 s | a arte de foto-pergunta ou uma imagem gerada, animada (traço desenhando, parallax, zoom lento) para story e Reels |
| `carrossel-video` | 9:16 | 15 a 25 s | os slides de um carrossel aprovado virando vídeo, um slide por batida |
| `demo` | 16:9 | 90 s, cortes de 30 s e 15 s | a demo de lançamento: proposta, projeto, cobrança, lucro |
| `corte-humano` | 9:16 | até 30 s | corte de um vídeo gravado com apresentador, com legenda queimada |

### Fontes visuais

- **UI real da Pilar, com dado encenado.** Suba o Pilar local no repo da Pilar
  (`supabase start`, `npm run seed`, `npm run dev:local`). O seed cria uma empresa
  fictícia com clientes, propostas, projetos, marcos, financeiro e obras (login
  `dev@local.test`). O banco local é compartilhado com outras sessões: nunca rode
  `supabase db reset` nele. Nunca grave produção nem dado de cliente real (LGPD). Se faltar um estado bom para a cena (projeto
  no vermelho, aditivo pendente), crie pelo próprio app ou por um SQL de cena em
  `video/scenes/*.sql`, nunca editando o seed do repo da Pilar.
- **Marca:** `assets/pilar-logo.svg`, paleta paper + ink com o verde `#A4EC86` só como
  acento, sem laranja. Embarque o arquivo da fonte na composição (o compilador do
  HyperFrames troca fonte do sistema por Google Fonts).
- **Imagens geradas:** use `src/utils/image-gen.js` (Gemini) ou a geração do `media-use`
  para croquis técnicos, pranchas, carimbos, réguas e cenas de escritório no estilo traço
  sobre papel. Gere em camadas separadas (fundo, objeto, detalhe) para animar com parallax
  e com o traço desenhando (SVG `stroke-dashoffset`). Sem pessoas com rosto gerado.
- **Telas estáticas:** quando a cena só precisa de um estado, tire screenshot em DPR 2 e
  anime na composição (zoom, pan, destaque de um número) em vez de gravar.

### Ferramentas e como usar

1. **Playwright para gravar a UI.**
   - Chromium com `--force-device-scale-factor=2`. O DPR só no contexto devolve frames
     em tamanho CSS.
   - Grave com `Page.startScreencast` via CDP e codifique em H.264 com ffmpeg.
   - Esconda o cursor real, registre você mesmo cada movimento e clique (tempo, x, y) num
     JSON da tomada e redesenhe cursor e ripple de clique na composição a 60 fps. O
     screencast chega entre 12 e 90 fps e o cursor gravado fica picotado.
   - Movimento com easing e leve curva, digitação com ritmo humano, pausa antes de cada
     clique.
   - Viewport de desktop para `demo`. Para 9:16, grave em desktop e enquadre por câmera
     (zoom e pan) na composição, ou grave no layout mobile quando a tela fizer sentido no
     celular.
2. **HyperFrames para compor** (HTML + GSAP, render determinístico).
   - Uma composição por tipo de vídeo em `video/templates/<tipo>/`, parametrizada pelo
     roteiro (texto, tempos, tomadas, números).
   - Janela da UI com keyframes de câmera, legendas e lower-thirds, título cinético,
     assinatura do logo no fim, cartão de CTA.
   - Antes de desenhar um efeito, procure no registry (`hyperframes-registry`).
   - Respeite a área segura do Reels: nada importante nos 220 px de cima nem nos 420 px
     de baixo em 1080x1920.
3. **Voz pt-BR.** `hyperframes tts` ou edge-tts com `pt-BR-AntonioNeural` ou
   `pt-BR-FranciscaNeural`, uma faixa por fala. Confira a pronúncia com
   `hyperframes transcribe` ("Pilar", "MEP", "RT", siglas de disciplina) e reescreva a
   fala foneticamente quando o TTS errar.
4. **Música e efeitos.** Trilha sem direito autoral (o `media-use` resolve BGM e SFX).
   Escolha pelo BPM e pelo brilho compatíveis com o ritmo de corte. Som de clique nos
   tempos de clique registrados.
5. **ffmpeg para mixar.** Uma linha do tempo única gera a imagem e o áudio, para não
   descasarem: cada fala com `adelay`, música com ducking por sidechain sob a voz, cliques
   nos tempos do JSON, `loudnorm` em -14 LUFS para redes. Legenda `.srt` gerada da mesma
   linha do tempo e queimada nos formatos 9:16 (a maioria assiste sem som).

### Estrutura no repo

```
video/
  REFERENCIAS.md
  templates/<tipo>/       composição HyperFrames parametrizada
  scenes/                 SQL de cena e roteiros de gravação Playwright por tela
  lib/record.js           gravação: cursor, digitação, screencast, log de eventos
  lib/timeline.js         roteiro → linha do tempo (falas, cortes, cliques, legendas)
  lib/mix.js              mixagem ffmpeg a partir da linha do tempo
  render.js               entrada: roteiro JSON + tipo → MP4 + capa + .srt
  out/                    gitignored
```

`npm run video -- --tipo reel-tela --roteiro <arquivo.json>` gera o MP4 e a capa, sobe
para o Supabase Storage (bucket `post-videos`) e devolve as URLs. A integração com a
inbox (asset do tipo vídeo aguardando aprovação) segue a SPEC 001, R6.

### Armadilhas conhecidas do método

- No GSAP, `fromTo` renderiza o estado inicial na hora. Use `immediateRender: false` nos
  ripples de clique, ou eles aparecem antes da hora.
- Um tween de câmera que passa do próximo `tl.set` vence no render sequencial mas não no
  `snapshot` (que faz seek). Faça o builder avisar quando o fim de um tween passa da
  próxima chave e confira frames do MP4 renderizado, não só os snapshots.
- O proxy RTK reescreve `git show` e corrompe binário. Para extrair fonte ou PNG do Git use
  `/usr/bin/git cat-file blob <rev>:<arquivo>` e confira com `file`.
- `hyperframes init` instala skills em `~/.claude/skills` de forma global.

### Regras de conteúdo

- Gancho nos primeiros 3 segundos, uma ideia por vídeo, CTA no fim ("Teste grátis por 3
  dias", link na bio). Tagline oficial: "Saiba se cada projeto está dando lucro antes de
  terminar."
- Voz de `docs/voice.md`: engenheiro falando com engenheiro, frase curta, número de
  verdade, sem buzzword, sem emoji corporativo.
- Público: escritório de projeto de engenharia ou arquitetura. Nada de canteiro nem de
  construtora como cliente-alvo.
- Nenhum número inventado como se fosse de cliente. Conta ilustrativa é dita como
  exemplo ("num projeto de R$ 40 mil...").

### Ordem de entrega

1. `video/REFERENCIAS.md` com os padrões escolhidos. Pare e me mostre.
2. Piloto: um `reel-tela` de 20 s mostrando a margem de um projeto no vermelho e um
   `reel-cinetico` de 15 s. Me mostre uma folha de quadros (um frame a cada 0,5 s) e o
   MP4 antes de generalizar.
3. Templates parametrizados para os outros tipos e o `render.js`.
4. Ligação com o `reel.js`: o roteiro gerado vira vídeo sem passo manual.
5. Demo de 90 s e os cortes de 30 s e 15 s para o lançamento de 19/01/2027.

### Pronto quando

- Um roteiro do `reel.js` vira MP4 9:16 com voz, música, legenda queimada e capa, por um
  comando só.
- O MP4 abre no Instagram sem recompressão visível (H.264, 30 fps, AAC, até 90 s).
- O áudio mede -14 LUFS (±1) e a voz é inteligível com a música por baixo.
- Nenhum quadro mostra dado real de cliente, laranja de marca ou texto fora da área segura.
- Revisei a folha de quadros e o MP4 de cada tipo antes de ele entrar no pipeline.
