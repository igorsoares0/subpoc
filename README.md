# SUPERTITLE — AI Video Subtitles

SaaS de legendagem de vídeo com IA. O usuário faz upload de um vídeo, o app transcreve o áudio automaticamente e ele edita as legendas e o visual num editor, exportando o vídeo final com as legendas gravadas ou o arquivo de legenda.

## Fluxo do usuário

1. **Cadastro/login** — email + senha (com verificação de email e reset de senha) ou Google.
2. **Upload do vídeo** — vai direto para o Cloudflare R2 via URL pré-assinada.
3. **Transcrição automática** — OpenAI Whisper gera as legendas com timestamps.
4. **Editor** (`app/editor/[id]`):
   - editar texto e timing das legendas
   - estilo via templates (fonte, cor, posição, fundo, animações)
   - formato: YouTube 16:9, Stories/TikTok 9:16, Feed 1:1, 4:3 ou original
   - trim do vídeo com timeline em filmstrip
   - logo e "hook" (texto de chamada) sobrepostos
   - preview em tempo real no navegador
5. **Exportação** — vídeo final renderizado com FFmpeg (legendas hardcoded) ou arquivo `.srt` / `.vtt`.

## Arquitetura

- **Next.js 16** (App Router) — frontend, API routes, auth (NextAuth v5), Postgres via Prisma, billing via Paddle, emails via Resend.
- **Worker Python** (`worker/`, FastAPI) — trabalho pesado: transcrição, renderização final e geração de filmstrip/thumbnails. Avisa o Next.js ao terminar via webhooks em `app/api/webhooks/*`.
- **Storage** — Cloudflare R2 (API S3).
- **Deploy** — VPS Hetzner + Coolify.

## Planos

Cobrança por minutos de vídeo processados por mês, debitados no upload-complete:

| Plano   | Preço    | Minutos/mês |
|---------|----------|-------------|
| Free    | —        | 10          |
| Starter | $12/mês  | 30          |
| Pro     | $29/mês  | 120         |

## Rodando localmente

Pré-requisitos: Node.js, Python 3.11+, Postgres, Redis e FFmpeg.

### App Next.js

```powershell
copy .env.example .env   # preencher as variáveis
npm install
npx prisma generate
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

### Worker Python

```powershell
cd worker
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # preencher as variáveis
uvicorn main:app --reload
```

Detalhes do worker em [`worker/README.md`](worker/README.md).

## Documentação adicional

- [`ARQUITETURA_SAAS_LEGENDAS.md`](ARQUITETURA_SAAS_LEGENDAS.md) — visão original da arquitetura (parcialmente desatualizada: cita Stripe/Vercel/Railway)
- [`FASTAPI_WORKER_GUIDE.md`](FASTAPI_WORKER_GUIDE.md) — guia do worker
- [`R2_SETUP.md`](R2_SETUP.md) — configuração do Cloudflare R2
- [`FILMSTRIP_IMPLEMENTATION.md`](FILMSTRIP_IMPLEMENTATION.md) — timeline com filmstrip
