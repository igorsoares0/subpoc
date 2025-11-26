# Mudanças no Next.js para Integração com Worker

## ✅ Arquivos Criados

### 1. Webhooks (recebem callbacks do worker)

**`app/api/webhooks/transcription/route.ts`**
- Recebe resultado da transcrição do worker
- Salva legendas no banco de dados
- Atualiza status do vídeo para "ready" ou "failed"

**`app/api/webhooks/render-complete/route.ts`**
- Recebe resultado da renderização do worker
- Salva URL do vídeo renderizado no banco
- Atualiza status do vídeo para "completed" ou "failed"

### 2. Template de Variáveis de Ambiente

**`.env.local.example`**
- Documentação de todas as variáveis necessárias
- Inclui novas variáveis do worker

## ✏️ Arquivos Modificados

### 1. Rota de Transcrição

**`app/api/videos/[id]/transcribe/route.ts`**

**Antes:** Processava FFmpeg + Whisper localmente (2-5 min, daria timeout)

**Depois:**
- Envia job para worker FastAPI
- Retorna resposta imediata
- Worker processa em background
- Worker notifica via webhook quando termina

### 2. Rota de Renderização

**`app/api/videos/[id]/render/route.ts`**

**Antes:** Processava FFmpeg localmente (5-15 min, daria timeout)

**Depois:**
- Envia job para worker FastAPI
- Retorna resposta imediata
- Worker processa em background
- Worker notifica via webhook quando termina

**Nota:** A função `GET` (download) foi mantida intacta

## 🔧 Configuração Necessária

### 1. Adicionar Variáveis de Ambiente

Crie ou edite `.env.local` e adicione:

```env
# Worker FastAPI
WORKER_URL=http://localhost:8000
WORKER_SECRET=seu-secret-super-forte-aqui

# App URL (para webhooks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**IMPORTANTE:**
- `WORKER_SECRET` deve ser o **mesmo valor** no Next.js e no Worker
- Em produção, use URLs reais:
  - `WORKER_URL=https://seu-worker.railway.app`
  - `NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app`

### 2. Verificar que o Worker está rodando

```bash
# Em outro terminal, na pasta worker/
cd worker
python main.py

# Deve mostrar:
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Reiniciar Next.js

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm run dev
```

## 🔄 Fluxo Completo

### Transcrição

```
1. Usuário clica "Transcribe"
   ↓
2. Next.js: POST /api/videos/[id]/transcribe
   - Atualiza status → "transcribing"
   - Envia job para Worker
   - Retorna resposta imediata
   ↓
3. Worker: Processa (2-5 min)
   - Download vídeo
   - Extrai áudio
   - Whisper API
   ↓
4. Worker: POST /api/webhooks/transcription
   - Envia legendas
   ↓
5. Next.js: Salva no banco
   - Status → "ready"
```

### Renderização

```
1. Usuário clica "Render"
   ↓
2. Next.js: POST /api/videos/[id]/render
   - Atualiza status → "rendering"
   - Envia job para Worker
   - Retorna resposta imediata
   ↓
3. Worker: Processa (5-15 min)
   - Download vídeo
   - Gera SRT
   - FFmpeg com legendas
   - Upload resultado
   ↓
4. Worker: POST /api/webhooks/render-complete
   - Envia URL do vídeo final
   ↓
5. Next.js: Salva no banco
   - Status → "completed"
```

## 🧪 Testando

### 1. Verificar Worker

```bash
curl http://localhost:8000/health
# Deve retornar: {"status":"healthy",...}
```

### 2. Testar Fluxo Completo

1. **Upload um vídeo** no Next.js
2. **Click em "Transcribe"**
3. **Monitore os logs:**
   - Terminal Next.js: veja o job sendo enviado
   - Terminal Worker: veja o processamento
4. **Aguarde webhook:** Next.js recebe callback
5. **Verifique banco:** status deve estar "ready"

### 3. Logs Esperados

**Next.js (ao clicar Transcribe):**
```
[Transcribe] Sending video abc123 to worker
[Transcribe] Video URL: http://localhost:3000/uploads/video.mp4
[Transcribe] Worker response: { status: "processing", ... }
```

**Worker (processando):**
```
[Download] Downloading video from http://...
[Audio] Extracting audio from /tmp/video_abc123.mp4
[Transcription] Sending to Whisper API...
[Transcription] ✓ Success! Video abc123 completed
```

**Next.js (recebendo webhook):**
```
[Webhook] Transcription callback for video abc123
[Webhook] Transcription completed for abc123: 42 subtitles
```

## ⚠️ Troubleshooting

### "Worker not configured"

**Erro:** Ao clicar em Transcribe/Render

**Causa:** Variáveis `WORKER_URL` ou `WORKER_SECRET` não definidas

**Solução:**
```bash
# Verifique .env.local
WORKER_URL=http://localhost:8000
WORKER_SECRET=seu-secret
```

### "Invalid token" no worker

**Erro:** No terminal do worker

**Causa:** `WORKER_SECRET` diferente entre Next.js e Worker

**Solução:** Use o **mesmo valor** em ambos os `.env`

### Webhook não chega

**Erro:** Worker processa mas Next.js não atualiza

**Causa:** Worker não consegue acessar `http://localhost:3000`

**Solução em desenvolvimento:**
```bash
# Use ngrok para expor Next.js
ngrok http 3000

# Use a URL do ngrok em .env.local
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

### Status fica "transcribing" para sempre

**Erro:** Status não muda

**Causa:** Webhook falhou ou worker deu erro

**Solução:** Verifique logs do worker para ver o erro real

## 📝 Dependências Removíveis

Após confirmar que tudo funciona, você pode remover do `package.json`:

```json
// Essas dependências não são mais usadas no Next.js:
"fluent-ffmpeg": "^2.1.3",
"@types/fluent-ffmpeg": "^2.1.28"

// Essa pode ser removida se não usar mock-subtitles:
"openai": "^6.9.1"
```

**Mas deixe para depois!** Primeiro teste tudo funcionando.

## 🚀 Deploy

### Desenvolvimento Local ✅

```bash
# Terminal 1
cd worker
python main.py

# Terminal 2
cd ..
npm run dev
```

### Produção (Railway + Vercel)

1. **Deploy Worker no Railway**
   - Siga `worker/NEXT_STEPS.md`
   - Copie URL: `https://seu-worker.railway.app`

2. **Configurar Vercel**
   - Settings → Environment Variables
   - Adicionar:
     ```
     WORKER_URL=https://seu-worker.railway.app
     WORKER_SECRET=mesmo-secret
     NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
     ```

3. **Redeploy Vercel**

---

**Tudo pronto! Agora você tem um sistema que não dá timeout.** 🎉
