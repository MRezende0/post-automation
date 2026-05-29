# Marca — Pilar

> Fonte: repo do produto em `/Users/matheus.rezende/Documents/Trinity/Pilar`
> (`tailwind.config.ts`, `src/styles/tokens.css`, `public/pilar-logo.svg`, `index.html`).
> Use isto pra manter os cards de post coerentes com a identidade do SaaS.

## Identidade

- **Produto:** Pilar — Sistema de Gestão (empresa: Trinity / `Trinity-Comp4ny`)
- **Instagram:** @pilar.software
- **Logo:** marca de coluna/pilar (capitel + fuste estriado), traços pretos `#0A0A0A`. Arquivo: `assets/pilar-logo.svg`.
- **Tom visual:** claro e minimalista (fundo off-white "paper"), texto quase-preto, acento verde-lima. Sóbrio, "design tokens", sombras sutis. NÃO é dark/agressivo.

## Paleta (HSL → HEX)

| Token | HSL | HEX | Uso |
|-------|-----|-----|-----|
| **brand** | `102 73% 73%` | `#A4EC86` | acento principal (verde-lima) |
| lime | `85 85% 45%` | ~`#86D916` | fim do gradiente brand |
| ink-900 | `0 0% 10%` | `#1A1A1A` | títulos / hook |
| ink-800 | `0 0% 24%` | `#3C3C3C` | corpo / secundário |
| paper-0 | `0 0% 100%` | `#FFFFFF` | cards elevados |
| paper-50 | `0 0% 99%` | `#FCFCFC` | fundo do app |
| paper-100 | `0 0% 97%` | `#F7F7F7` | landing / sidebar |
| paper-200 | `0 0% 93%` | `#EDEDED` | superfícies muted |

- **Gradiente brand:** `linear-gradient(135deg, #A4EC86, #86D916)`
- **Gradiente ink:** `linear-gradient(135deg, #1A1A1A, #3C3C3C)`
- **Texto sobre brand:** ink-900 (verde é claro → texto escuro por cima).
- **Laranja NÃO é cor de marca.** No app é só status interno (projeto ativo/pausado). **Não usar nos posts.**

## Aplicação nos cards de post

- Fundo: paper (claro) ou ink (escuro) conforme o pilar; acento sempre verde-brand. Sem laranja.
- Logo no rodapé + handle `@pilar.software`.
- Manter contraste alto (ink sobre paper) — legibilidade no feed.

> ⚠️ Os templates atuais em `templates/` ainda usam paleta genérica (dark/vermelho).
> Repintar pra esta paleta é um passo pendente — ver conversa.
