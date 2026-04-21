# Phase 0 — Protótipo de render frame-by-frame

Valida a viabilidade técnica da migração para o modelo "Remotion caseiro":
**mesmo componente React roda no editor e no worker**, capturado frame-a-frame
via Playwright.

## Arquivos criados

- `components/prototype/AnimatedSubtitle.tsx` — componente React determinístico,
  recebe `currentTime` como prop e anima 9 palavras word-by-word (pop + color +
  background arredondado). Easing `easeOutBack` pra efeito "Submagic-style".
- `app/prototype/subtitle/page.tsx` — rota headless. Renderiza o componente em
  fundo transparente. Após `document.fonts.ready`, expõe `window.__setTime(t)`
  que usa `flushSync` + rAF duplo para forçar render síncrono antes do
  screenshot.
- `worker/prototype_render.py` — script Python que abre Playwright, captura N
  frames, monta MP4 via FFmpeg e imprime benchmark.

## Como rodar

**Terminal 1 — servidor Next.js:**

```bash
npm run dev
```

**Terminal 2 — script de render:**

```bash
cd worker
# ativa venv (já existente no projeto)
source venv/bin/activate       # Linux/Mac/WSL
# venv\Scripts\activate        # Windows

python prototype_render.py
```

Variantes úteis:

```bash
# Full frame (1080x1920, 3.2s @ 30fps = 96 frames)
python prototype_render.py

# Bbox only (muito mais rápido — captura só a região da legenda)
python prototype_render.py --bbox

# Formato YouTube landscape
python prototype_render.py --width 1920 --height 1080

# Vídeo mais longo pra medir escala
python prototype_render.py --duration 10
```

## O que olhar

Após rodar, o script imprime algo como:

```
[proto] === BENCHMARK ===
[proto] Captured: 96 frames in 8.42s
[proto] Per frame: 87.7 ms
[proto] 1min video (1800 frames) ≈ 158s
[proto] 5min video (9000 frames) ≈ 13.2min
[proto] 10min video (18000 frames) ≈ 26.3min
```

E gera `worker/prototype_output/prototype.mp4`. Abre ele e verifica:

1. **A animação está fluida?** Palavra ativa deve "pulsar" com scale 0.72 → ~1.05 → 1.0 (easeOutBack overshoot) em 120ms, acompanhada de cor amarela e fundo vermelho.
2. **Sincronização correta?** Cada palavra aparece destacada no seu tempo certo (veja `PROTOTYPE_WORDS` em `AnimatedSubtitle.tsx`).
3. **Sem flicker ou frame preto?** Se aparecer, o harness não está esperando o re-render.
4. **Texto nítido?** Sem "fonte fallback" genérica — a Montserrat Black deve aparecer.

## Critérios de validação

| Métrica | Meta MVP | O que significa se falhar |
|---|---|---|
| **ms/frame (bbox)** | < 80 ms | Inviável sem pool de 4+ pages |
| **ms/frame (full frame)** | < 200 ms | Use `--bbox` ou reduza resolução |
| **Animação fluida** | Sim, visível | Problema no componente (não-determinístico?) |
| **Sync por palavra** | Sim, no tempo correto | `flushSync` não está forçando render |
| **Fonte correta** | Montserrat Black | Fonts não carregadas antes do setTime |

## Próximos passos se Fase 0 passar

1. Fase 1: extrair `<SubtitleTrack />` real (não protótipo) com todas as props
   de estilo existentes e o editor passa a usar ele.
2. Fase 2: o worker refatora `rendering.py` para usar a rota `/render/[id]` ao
   invés de `_render_subtitle_pngs`.
3. Fase 3: pool de pages, cache de frames, skip de regiões vazias.

## Próximos passos se Fase 0 falhar

- **Muito lento (>500ms/frame)**: Playwright/Chromium não aguenta. Plano B: engine
  em Canvas 2D com `node-canvas`.
- **Animação travada/quebrada**: componente não é 100% determinístico, ou
  harness tem race condition com o React commit.
- **Texto errado/fallback font**: ajustar `document.fonts.ready` ou preload
  explícito das famílias.
