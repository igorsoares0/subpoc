# 🚀 Próximos Passos

O worker FastAPI foi criado com sucesso! Agora você precisa:

## 1️⃣ Configurar o Worker Localmente

```bash
# Entrar na pasta do worker
cd worker

# Criar arquivo .env (copie do .env.example)
cp .env.example .env

# Editar .env com suas credenciais
# Você precisa adicionar:
# - OPENAI_API_KEY=sk-...
# - WORKER_SECRET=algum-secret-forte-aqui
```

## 2️⃣ Instalar FFmpeg (se ainda não tiver)

```bash
# Ubuntu/Debian/WSL
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download de: https://ffmpeg.org/download.html
```

Verificar instalação:
```bash
ffmpeg -version
```

## 3️⃣ Instalar Dependências Python

```bash
# Criar virtual environment (recomendado)
python -m venv venv

# Ativar virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt
```

## 4️⃣ Testar o Worker Localmente

```bash
# Rodar o servidor
uvicorn main:app --reload

# Ou usando Python diretamente
python main.py
```

Você deve ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Acesse http://localhost:8000/docs para ver a documentação interativa!

## 5️⃣ Modificar o Next.js

Agora você precisa criar as rotas de webhook e modificar as rotas de transcrição/renderização.

### A) Criar webhooks no Next.js

**`app/api/webhooks/transcription/route.ts`**
```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { videoId, subtitles, status, error } = await req.json()

    if (error) {
      await prisma.videoProject.update({
        where: { id: videoId },
        data: { status: "failed" }
      })
      return NextResponse.json({ success: false, error })
    }

    await prisma.videoProject.update({
      where: { id: videoId },
      data: { subtitles, status: "ready" }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}
```

**`app/api/webhooks/render-complete/route.ts`**
```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { videoId, outputUrl, status, error } = await req.json()

    if (error) {
      await prisma.videoProject.update({
        where: { id: videoId },
        data: { status: "failed" }
      })
      return NextResponse.json({ success: false, error })
    }

    await prisma.videoProject.update({
      where: { id: videoId },
      data: { outputUrl, status: "completed" }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}
```

### B) Atualizar variáveis de ambiente do Next.js

**`.env.local`** (adicionar):
```env
# Worker FastAPI
WORKER_URL=http://localhost:8000
WORKER_SECRET=mesmo-secret-do-worker
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### C) Modificar rotas de transcrição e renderização

Veja o arquivo `FASTAPI_WORKER_GUIDE.md` seção "Modificações no Next.js" para o código completo.

Basicamente, você vai **substituir** o processamento por **envio de job** para o worker.

## 6️⃣ Testar o Fluxo Completo

1. **Inicie o Worker:**
   ```bash
   cd worker
   python main.py
   ```

2. **Inicie o Next.js:**
   ```bash
   # Em outro terminal
   cd ..
   npm run dev
   ```

3. **Teste:**
   - Faça upload de um vídeo
   - Click em "Transcribe"
   - Monitore os logs em ambos os terminais
   - Veja o webhook sendo chamado

## 7️⃣ Deploy (Quando tudo funcionar localmente)

### Deploy do Worker no Railway:

1. Acesse https://railway.app
2. New Project → Deploy from GitHub
3. Conecte o repositório
4. Configure variáveis de ambiente:
   - `OPENAI_API_KEY`
   - `WORKER_SECRET`
   - `ENVIRONMENT=production`
5. Se FFmpeg não funcionar, crie `nixpacks.toml`:
   ```toml
   [phases.setup]
   aptPkgs = ["ffmpeg"]
   ```

### Configurar Vercel:

1. No Vercel Dashboard, vá em Settings → Environment Variables
2. Adicione:
   - `WORKER_URL=https://seu-worker.railway.app`
   - `WORKER_SECRET=mesmo-secret`
   - `NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app`
3. Redeploy

## ❓ Problemas Comuns

### "ModuleNotFoundError: No module named 'fastapi'"
→ Instale as dependências: `pip install -r requirements.txt`

### "FFmpeg not found"
→ Instale FFmpeg (veja passo 2)

### "Invalid token" no worker
→ Verifique se `WORKER_SECRET` é o mesmo em ambos os projetos

### Webhook não funciona em localhost
→ Use ngrok para expor o Next.js:
```bash
ngrok http 3000
# Use a URL do ngrok em NEXT_PUBLIC_APP_URL
```

## 📚 Documentação Completa

- **`README.md`** - Documentação do worker
- **`FASTAPI_WORKER_GUIDE.md`** - Guia completo de implementação
- **`ARQUITETURA_SAAS_LEGENDAS.md`** - Arquitetura geral do projeto

---

**Tudo pronto! Comece pelo passo 1 e vá testando cada etapa.** 🎉
