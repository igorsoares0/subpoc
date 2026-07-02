# Setup Cloudflare R2

Integração completa: upload direto browser → R2 (presigned PUT), worker lê e
grava no bucket via boto3, e tudo é servido por presigned GET atrás do auth do
app. **O bucket é privado** — não habilite r2.dev nem "public access".

Arquitetura de keys (tudo de um projeto sob um prefixo, apagado junto no delete):

```
projects/{projectId}/original.mp4    ← upload do usuário
projects/{projectId}/filmstrip.jpg   ← sprite da timeline (worker)
projects/{projectId}/rendered.mp4    ← vídeo final (worker)
projects/{projectId}/logo.png        ← logo/watermark
```

---

## 1. Criar os buckets (PowerShell)

```powershell
npx wrangler login
npx wrangler r2 bucket create subs-media --location=weur
npx wrangler r2 bucket create subs-media-dev --location=weur
```

`weur` = Western Europe, perto do VPS Hetzner (worker e app baixam/sobem
vídeo o tempo todo — latência importa mais que proximidade do usuário final).
Um bucket para produção, outro para desenvolvimento local.

## 2. CORS nos buckets

O browser faz `PUT` direto no R2 (upload) e `GET` (player/canvas), então o
bucket precisa liberar as origens do app. Os arquivos `cors.json` (produção)
e `cors-dev.json` (localhost) já estão na raiz do repo, no formato da API do
R2 que o wrangler espera (objeto com `rules` — diferente do formato S3 usado
no dashboard):

```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["https://SEU-DOMINIO.com"],
        "methods": ["GET", "PUT"],
        "headers": ["Content-Type"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

Em `cors.json`, troque `SEU-DOMINIO.com` pelo domínio real do app antes de
aplicar.

Aplicar (ou pelo dashboard: R2 → bucket → Settings → CORS policy):

```powershell
npx wrangler r2 bucket cors set subs-media --file cors.json
npx wrangler r2 bucket cors set subs-media-dev --file cors-dev.json
```

Manter `AllowedOrigins` restrito ao seu domínio é parte da proteção de custo:
nenhum outro site consegue usar suas presigned URLs de upload via browser.

## 3. Tokens de API (dashboard)

Dashboard → **R2 → Manage API Tokens → Create API Token**. Crie **dois**
tokens, ambos com permissão **Object Read & Write** e **escopo restrito ao
bucket** (nunca "Admin" e nunca conta inteira):

| Token          | Usado por          | Vai em                  |
| -------------- | ------------------ | ----------------------- |
| `subs-nextjs`  | Next.js (presign)  | `.env` do app / Coolify |
| `subs-worker`  | Worker Python      | `worker/.env`           |

Tokens separados = revogação independente se um vazar. Anote o
`Access Key ID` e o `Secret Access Key` de cada um, e o Account ID
(canto direito do dashboard R2).

## 4. Variáveis de ambiente

**Next.js** (`.env` local e Coolify em produção):

```env
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="...(token subs-nextjs)"
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="subs-media"        # subs-media-dev no local
```

**Worker** (`worker/.env`):

```env
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="...(token subs-worker)"
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="subs-media"        # subs-media-dev no local
```

`R2_PUBLIC_URL` não existe mais — bucket privado não tem URL pública.

## 5. Lifecycle (proteção de fatura)

Uploads multipart incompletos são abortados **automaticamente após 7 dias**
(default do R2) — não precisa configurar nada para o fluxo atual (PUT único).
Se um dia ativar multipart para arquivos maiores, dá para reduzir esse prazo
em R2 → bucket → Settings → **Object lifecycle rules**.

Não use storage class *Infrequent Access* aqui: tem cobrança mínima de 30
dias + taxa de leitura — pior para vídeos que o usuário pode deletar cedo.

## 6. Onde o dinheiro vai (e onde não vai)

- **Egress: R$ 0, sempre.** É a razão de usar R2 e não S3 — servir vídeo não
  custa nada, não importa quantos plays.
- **Storage**: US$ 0,015/GB-mês (10 GB-mês grátis). É o único custo que
  cresce sozinho. As defesas no código:
  - delete de projeto apaga `projects/{id}/*` inteiro no R2;
  - `upload-complete` confere o tamanho real via HEAD e apaga o objeto se
    passar de 500MB (cliente não consegue burlar o limite declarado);
  - upload só via presigned URL de 1h, criada por usuário autenticado.
- **Operações**: Class A (writes) US$ 4,50/milhão, Class B (reads)
  US$ 0,36/milhão — com 1M grátis/mês de A e 10M de B. Cada projeto usa
  ~10 operações; irrelevante no seu volume por anos.
- Recomendado: dashboard → Billing → **Notifications**, criar alerta de
  gasto (ex.: US$ 5) para dormir tranquilo.

Estimativa MVP: 100 usuários × 5 vídeos de 100MB ≈ 50 GB ≈ **US$ 0,60/mês**.

## 7. Testar

1. `npm run dev` + worker rodando (`uvicorn main:app --reload` na pasta worker)
2. Upload de um vídeo → barra de progresso agora é real (XHR direto pro R2)
3. Conferir no dashboard R2: `projects/{id}/original.mp4` apareceu
4. Editor abre o vídeo (URL assinada), filmstrip aparece na timeline
5. Transcrever → legendas chegam (webhook agora exige o `WORKER_SECRET`)
6. Renderizar → `projects/{id}/rendered.mp4` no bucket e download funciona
7. Deletar o projeto → prefixo some do bucket

## Segurança — o que mudou no código

- Webhooks (`/api/webhooks/*`) agora exigem `Authorization: Bearer
  WORKER_SECRET` (antes eram públicos: qualquer um podia sobrescrever
  legendas/status de qualquer vídeo).
- Presigned PUT assina o `Content-Type`: só os MIME types de vídeo da
  whitelist passam.
- O banco guarda **keys**, nunca URLs; URLs assinadas (12h) são geradas na
  leitura, por usuário autenticado e dono do projeto.
- PATCH de logo ignora `logoUrl` do body (senão o cliente sobrescreveria a
  key com a URL temporária).
- Logo aceita só PNG/JPEG/WebP (SVG pode carregar script).
