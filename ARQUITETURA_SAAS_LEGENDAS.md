# Arquitetura do SaaS de Legendagem de Vídeos

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Divisão de Responsabilidades](#divisão-de-responsabilidades)
4. [Fluxo Completo do Usuário](#fluxo-completo-do-usuário)
5. [Estrutura de Dados](#estrutura-de-dados)
6. [Implementação Next.js](#implementação-nextjs)
7. [Implementação Python](#implementação-python)
8. [Comunicação Entre Serviços](#comunicação-entre-serviços)
9. [Deploy e Infraestrutura](#deploy-e-infraestrutura)
10. [Custos Estimados](#custos-estimados)

---

## Visão Geral

### Arquitetura Híbrida

```
┌─────────────────────────────────────────────┐
│            Next.js (Vercel)                 │
│                                             │
│  • Frontend completo                        │
│  • API Routes (CRUD)                        │
│  • Autenticação (NextAuth)                  │
│  • Stripe (pagamentos)                      │
│  • Editor de legendas                       │
│  • 90% da aplicação                         │
│                                             │
└──────────────┬──────────┬───────────────────┘
               │          │
        HTTP   │          │  Webhook
               ▼          ▲
      ┌────────────────────────┐
      │   Python (Railway)     │
      │                        │
      │  • Transcrição         │
      │  • Renderização Final  │
      │  • 10% da aplicação    │
      │                        │
      └────────────────────────┘
```

### Por Que Essa Arquitetura?

**Problema:** Vercel tem timeout de 60 segundos em serverless functions.

**Solução:** Separar operações que demoram mais de 60 segundos em um microsserviço dedicado.

---

## Stack Tecnológica

### Frontend + Backend Principal (Next.js)

```json
{
  "framework": "Next.js 14+",
  "linguagem": "TypeScript",
  "database": "PostgreSQL (Neon)",
  "ORM": "Prisma",
  "auth": "NextAuth.js v5",
  "pagamentos": "Stripe",
  "storage": "Cloudflare R2 ou Vercel Blob",
  "UI": "Tailwind CSS + shadcn/ui",
  "estado": "Zustand",
  "hosting": "Vercel"
}
```

### Microsserviço de Processamento (Python)

```json
{
  "framework": "FastAPI",
  "linguagem": "Python 3.11+",
  "transcrição": "OpenAI Whisper API",
  "processamento": "FFmpeg",
  "hosting": "Railway ou Render"
}
```

---

## Divisão de Responsabilidades

### ✅ Next.js Faz (Operações < 60 segundos)

| Feature | Tempo | Descrição |
|---------|-------|-----------|
| **Upload de vídeo** | < 5s | Upload para R2/Blob |
| **CRUD de projetos** | < 1s | Criar/ler/atualizar/deletar |
| **Editar legendas** | < 1s | Atualizar texto/timing no JSON |
| **Editar estilo** | < 1s | Cor, fonte, posição, background |
| **Escolher formato** | < 1s | Instagram/TikTok/YouTube |
| **Trim (marcar cortes)** | < 1s | Salvar timestamps |
| **Add imagem/logo** | < 1s | Salvar configuração overlay |
| **Preview** | Instantâneo | CSS sobre vídeo (frontend) |
| **Undo/Redo** | Instantâneo | State management (frontend) |
| **Autenticação** | < 1s | Login/registro/sessões |
| **Stripe** | < 1s | Checkout/webhooks/portal |
| **Dashboard** | < 1s | Listar projetos/stats |

### ⚠️ Python Faz (Operações > 60 segundos)

| Feature | Tempo | Descrição |
|---------|-------|-----------|
| **Transcrição** | 2-5 min | Whisper API → gerar SRT |
| **Export Final** | 5-15 min | FFmpeg → vídeo com legendas hardcoded |

**Apenas 2 operações no Python!**

---

## Fluxo Completo do Usuário

### 1. Upload e Transcrição

```mermaid
sequenceDiagram
    participant U as Usuário
    participant N as Next.js
    participant P as Python
    participant W as Whisper API

    U->>N: Upload vídeo
    N->>N: Salva no R2/Blob
    N->>N: Cria registro no Postgres
    N->>P: POST /transcribe (HTTP)
    P->>P: Download vídeo
    P->>P: Extrai áudio
    P->>W: Envia áudio
    W->>P: Retorna transcrição
    P->>N: POST /webhook (resultado)
    N->>N: Salva legendas no Postgres
    N->>U: Notifica (WebSocket/Pusher)
```

**Código Next.js:**
```typescript
// app/api/videos/transcribe/route.ts
export async function POST(req: Request) {
  const { videoId } = await req.json();
  
  const video = await prisma.videoProject.findUnique({
    where: { id: videoId }
  });
  
  // Envia pro Python
  await fetch(process.env.WORKER_URL + '/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      videoId: video.id,
      videoUrl: video.videoUrl,
      webhookUrl: `${process.env.APP_URL}/api/webhooks/transcription`
    })
  });
  
  // Atualiza status
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { status: 'transcribing' }
  });
  
  return Response.json({ status: 'processing' });
}
```

### 2. Edição (Tudo no Next.js)

```
Usuário edita → Next.js atualiza JSON no Postgres → Pronto!
```

**Operações instantâneas:**
- Editar texto das legendas
- Mudar cor/fonte/posição
- Escolher formato (Instagram/TikTok)
- Marcar trim
- Adicionar imagens

**Código Next.js:**
```typescript
// app/api/videos/[id]/subtitles/route.ts
export async function PATCH(req: Request) {
  const { subtitles } = await req.json();
  
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { subtitles } // Salva JSON
  });
  
  return Response.json({ success: true });
}

// app/api/videos/[id]/style/route.ts
export async function PATCH(req: Request) {
  const { style } = await req.json();
  
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { subtitleStyle: style } // Salva JSON
  });
  
  return Response.json({ success: true });
}
```

### 3. Preview (Frontend)

```typescript
// Preview em tempo real usando CSS
const VideoPreview = ({ video, currentTime }) => {
  const currentSubtitle = video.subtitles.find(
    sub => currentTime >= sub.start && currentTime < sub.end
  );
  
  return (
    <div className="relative">
      <video src={video.videoUrl} />
      {currentSubtitle && (
        <div 
          className="absolute"
          style={{
            color: video.subtitleStyle.color,
            fontSize: video.subtitleStyle.fontSize,
            // ... outros estilos
          }}
        >
          {currentSubtitle.text}
        </div>
      )}
    </div>
  );
};
```

### 4. Export Final

```mermaid
sequenceDiagram
    participant U as Usuário
    participant N as Next.js
    participant P as Python
    participant F as FFmpeg

    U->>N: Click "Exportar"
    N->>N: Busca config no Postgres
    N->>P: POST /render (HTTP)
    P->>P: Download vídeo
    P->>P: Gera SRT
    P->>F: Aplica legendas + format
    F->>P: Vídeo renderizado
    P->>P: Upload pro R2
    P->>N: POST /webhook (URL final)
    N->>N: Salva URL no Postgres
    N->>U: Notifica (download pronto)
```

**Código Next.js:**
```typescript
// app/api/videos/export/route.ts
export async function POST(req: Request) {
  const { videoId } = await req.json();
  
  const video = await prisma.videoProject.findUnique({
    where: { id: videoId },
    include: { user: { include: { subscription: true } } }
  });
  
  // Verificar limites
  const check = await checkSubscriptionLimits(
    video.user.id, 
    video.duration
  );
  
  if (!check.allowed) {
    return Response.json({ error: check.message }, { status: 403 });
  }
  
  // Enviar pro Python
  await fetch(process.env.WORKER_URL + '/render', {
    method: 'POST',
    body: JSON.stringify({
      videoId: video.id,
      videoUrl: video.videoUrl,
      subtitles: video.subtitles,
      style: video.subtitleStyle,
      format: video.format,
      trim: video.trim,
      overlays: video.overlays,
      webhookUrl: `${process.env.APP_URL}/api/webhooks/render-complete`
    })
  });
  
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { status: 'rendering' }
  });
  
  return Response.json({ status: 'processing' });
}
```

---

## Estrutura de Dados

### Schema Prisma (Next.js)

```prisma
// prisma/schema.prisma

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  
  subscription  Subscription?
  videoProjects VideoProject[]
  
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Subscription {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  stripeCustomerId       String   @unique
  stripeSubscriptionId   String   @unique
  
  status                 String   // active, canceled, past_due
  plan                   String   // basic, pro
  
  minutesUsed            Int      @default(0)
  minutesLimit           Int      @default(100)
  
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

model VideoProject {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Vídeo original
  videoUrl          String
  duration          Float    // minutos
  thumbnailUrl      String?
  
  // Status do processamento
  status            String   @default("uploading")
  // uploading, transcribing, ready, rendering, completed, failed
  
  // Legendas (JSON)
  subtitles         Json?
  // Estrutura: [{id: 1, start: 0, end: 3.5, text: "Hello"}]
  
  // Estilo das legendas (JSON)
  subtitleStyle     Json?
  // Estrutura: {fontFamily, fontSize, color, backgroundColor, position, alignment, outline...}
  
  // Configurações de export
  format            String?  // instagram_story, instagram_feed, tiktok, youtube, original
  trim              Json?    // {start: 10, end: 30}
  overlays          Json[]   @default([])
  // Estrutura: [{type: "image", url: "...", x: 10, y: 10, width: 100, height: 100}]
  
  // Vídeo final
  outputUrl         String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
}
```

### Estrutura de JSON

**Subtitles:**
```json
[
  {
    "id": 1,
    "start": 0,
    "end": 3.5,
    "text": "Olá, bem-vindo ao vídeo"
  },
  {
    "id": 2,
    "start": 3.5,
    "end": 7.2,
    "text": "Hoje vamos falar sobre legendas"
  }
]
```

**SubtitleStyle:**
```json
{
  "fontFamily": "Arial",
  "fontSize": 24,
  "color": "#FFFFFF",
  "backgroundColor": "#000000",
  "backgroundOpacity": 0.7,
  "position": "bottom",
  "alignment": "center",
  "outline": true,
  "outlineColor": "#000000",
  "outlineWidth": 2
}
```

**Trim:**
```json
{
  "start": 10,
  "end": 30
}
```

**Overlays:**
```json
[
  {
    "type": "image",
    "url": "https://cdn.com/logo.png",
    "x": 10,
    "y": 10,
    "width": 100,
    "height": 100
  }
]
```

---

## Implementação Next.js

### Estrutura de Pastas

```
seu-saas/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── editor/
│   │   └── [videoId]/
│   │       └── page.tsx
│   ├── pricing/
│   │   └── page.tsx
│   │
│   └── api/
│       ├── videos/
│       │   ├── route.ts                    # GET (listar), POST (criar)
│       │   ├── [id]/
│       │   │   ├── route.ts                # GET, PATCH, DELETE
│       │   │   ├── subtitles/
│       │   │   │   └── route.ts            # PATCH (editar legendas)
│       │   │   ├── style/
│       │   │   │   └── route.ts            # PATCH (editar estilo)
│       │   │   ├── format/
│       │   │   │   └── route.ts            # PATCH (escolher formato)
│       │   │   ├── trim/
│       │   │   │   └── route.ts            # PATCH (marcar trim)
│       │   │   └── overlays/
│       │   │       └── route.ts            # PATCH (add imagens)
│       │   ├── transcribe/
│       │   │   └── route.ts                # POST (enviar pro Python)
│       │   └── export/
│       │       └── route.ts                # POST (enviar pro Python)
│       │
│       ├── stripe/
│       │   ├── checkout/
│       │   │   └── route.ts                # POST (criar session)
│       │   ├── webhook/
│       │   │   └── route.ts                # POST (receber eventos)
│       │   └── portal/
│       │       └── route.ts                # POST (customer portal)
│       │
│       └── webhooks/
│           ├── transcription/
│           │   └── route.ts                # POST (recebe do Python)
│           └── render-complete/
│               └── route.ts                # POST (recebe do Python)
│
├── components/
│   ├── video-editor/
│   │   ├── VideoPreview.tsx
│   │   ├── SubtitleEditor.tsx
│   │   ├── StyleEditor.tsx
│   │   └── Timeline.tsx
│   └── ui/                                 # shadcn/ui components
│
├── lib/
│   ├── prisma.ts
│   ├── stripe.ts
│   ├── subscription.ts
│   └── storage.ts                          # R2/Blob helpers
│
└── prisma/
    └── schema.prisma
```

### Principais Rotas da API

**1. Transcrição (envia pro Python)**
```typescript
// app/api/videos/transcribe/route.ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await req.json();
  
  const video = await prisma.videoProject.findUnique({
    where: { id: videoId, userId: session.user.id }
  });

  if (!video) {
    return Response.json({ error: 'Video not found' }, { status: 404 });
  }

  // Enviar pro Python
  await fetch(process.env.WORKER_URL + '/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WORKER_SECRET}`
    },
    body: JSON.stringify({
      videoId: video.id,
      videoUrl: video.videoUrl,
      webhookUrl: `${process.env.APP_URL}/api/webhooks/transcription`
    })
  });

  // Atualizar status
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { status: 'transcribing' }
  });

  return Response.json({ status: 'processing' });
}
```

**2. Webhook de Transcrição (recebe do Python)**
```typescript
// app/api/webhooks/transcription/route.ts
import { prisma } from '@/lib/prisma';
import { pusher } from '@/lib/pusher'; // Para notificação real-time

export async function POST(req: Request) {
  const { videoId, subtitles, status, error } = await req.json();

  if (error) {
    await prisma.videoProject.update({
      where: { id: videoId },
      data: { status: 'failed' }
    });
    
    // Notificar usuário sobre erro
    await pusher.trigger(`video-${videoId}`, 'transcription-failed', { error });
    
    return Response.json({ success: false });
  }

  // Salvar legendas
  await prisma.videoProject.update({
    where: { id: videoId },
    data: { 
      subtitles,
      status: 'ready' 
    }
  });

  // Notificar usuário que está pronto
  await pusher.trigger(`video-${videoId}`, 'transcription-complete', {});

  return Response.json({ success: true });
}
```

**3. Editar Legendas (só Next.js)**
```typescript
// app/api/videos/[id]/subtitles/route.ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subtitles } = await req.json();

  const video = await prisma.videoProject.update({
    where: { 
      id: params.id,
      userId: session.user.id 
    },
    data: { subtitles }
  });

  return Response.json({ video });
}
```

**4. Export Final (envia pro Python)**
```typescript
// app/api/videos/export/route.ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { checkSubscriptionLimits, incrementMinutesUsed } from '@/lib/subscription';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await req.json();

  const video = await prisma.videoProject.findUnique({
    where: { id: videoId, userId: session.user.id }
  });

  if (!video) {
    return Response.json({ error: 'Video not found' }, { status: 404 });
  }

  // Verificar limites de assinatura
  const check = await checkSubscriptionLimits(session.user.id, video.duration);
  if (!check.allowed) {
    return Response.json({ 
      error: check.reason,
      message: check.message 
    }, { status: 403 });
  }

  // Incrementar uso
  await incrementMinutesUsed(session.user.id, video.duration);

  // Enviar pro Python
  await fetch(process.env.WORKER_URL + '/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WORKER_SECRET}`
    },
    body: JSON.stringify({
      videoId: video.id,
      videoUrl: video.videoUrl,
      subtitles: video.subtitles,
      style: video.subtitleStyle,
      format: video.format,
      trim: video.trim,
      overlays: video.overlays,
      webhookUrl: `${process.env.APP_URL}/api/webhooks/render-complete`
    })
  });

  await prisma.videoProject.update({
    where: { id: videoId },
    data: { status: 'rendering' }
  });

  return Response.json({ 
    status: 'processing',
    remaining: check.remaining 
  });
}
```

---

## Implementação Python

### Estrutura do Microsserviço

```
worker/
├── main.py              # FastAPI app
├── transcription.py     # Lógica de transcrição
├── rendering.py         # Lógica de renderização
├── utils.py             # Helpers (download, upload, etc)
├── requirements.txt
└── Dockerfile           # Opcional (Railway detecta Python automaticamente)
```

### Código Completo

**main.py**
```python
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
import os
from transcription import process_transcription
from rendering import process_rendering

app = FastAPI()

WORKER_SECRET = os.getenv("WORKER_SECRET")

def verify_secret(authorization: str = Header(None)):
    """Verificar segurança do request"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split("Bearer ")[1]
    if token != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/")
async def root():
    return {"status": "ok", "service": "subtitle-worker"}

@app.post("/transcribe")
async def transcribe(
    videoId: str,
    videoUrl: str,
    webhookUrl: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """Endpoint de transcrição"""
    verify_secret(authorization)
    
    # Processar em background
    background_tasks.add_task(
        process_transcription,
        videoId, videoUrl, webhookUrl
    )
    
    return {"status": "processing", "videoId": videoId}

@app.post("/render")
async def render(
    videoId: str,
    videoUrl: str,
    subtitles: list,
    style: dict,
    format: str,
    trim: dict,
    overlays: list,
    webhookUrl: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """Endpoint de renderização"""
    verify_secret(authorization)
    
    # Processar em background
    background_tasks.add_task(
        process_rendering,
        videoId, videoUrl, subtitles, style, 
        format, trim, overlays, webhookUrl
    )
    
    return {"status": "processing", "videoId": videoId}
```

**transcription.py**
```python
import openai
import httpx
import os
from utils import download_video, extract_audio

async def process_transcription(video_id: str, video_url: str, webhook_url: str):
    """Processar transcrição do vídeo"""
    try:
        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)
        
        # 2. Extrair áudio
        audio_path = extract_audio(video_path)
        
        # 3. Transcrever com Whisper
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language="pt"
            )
        
        # 4. Formatar resultado
        subtitles = [
            {
                "id": i,
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip()
            }
            for i, seg in enumerate(transcription.segments, start=1)
        ]
        
        # 5. Notificar Next.js
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json={
                "videoId": video_id,
                "subtitles": subtitles,
                "status": "completed"
            }, timeout=30.0)
        
        # 6. Limpar arquivos temporários
        os.remove(video_path)
        os.remove(audio_path)
        
    except Exception as e:
        print(f"Error in transcription: {e}")
        
        # Notificar erro
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json={
                "videoId": video_id,
                "error": str(e),
                "status": "failed"
            }, timeout=30.0)
```

**rendering.py**
```python
import ffmpeg
import httpx
import os
from utils import download_video, upload_to_storage, generate_srt_file

async def process_rendering(
    video_id: str,
    video_url: str,
    subtitles: list,
    style: dict,
    format_type: str,
    trim: dict,
    overlays: list,
    webhook_url: str
):
    """Processar renderização do vídeo final"""
    try:
        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)
        
        # 2. Gerar arquivo SRT
        srt_path = generate_srt_file(subtitles, video_id)
        
        # 3. Construir filtros FFmpeg
        filters = []
        
        # Formato (crop/resize)
        if format_type == "instagram_story":
            filters.append("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black")
        elif format_type == "instagram_feed":
            filters.append("scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black")
        elif format_type == "tiktok":
            filters.append("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black")
        elif format_type == "youtube":
            filters.append("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black")
        
        # Legendas (hardcode)
        subtitle_style = build_subtitle_style(style)
        filters.append(f"subtitles={srt_path}:force_style='{subtitle_style}'")
        
        # Combinar filtros
        video_filter = ",".join(filters) if filters else None
        
        # 4. Aplicar trim se especificado
        input_args = {}
        if trim and trim.get("start") is not None:
            input_args["ss"] = trim["start"]
        if trim and trim.get("end") is not None:
            input_args["to"] = trim["end"]
        
        # 5. Renderizar com FFmpeg
        output_path = f"/tmp/rendered_{video_id}.mp4"
        
        stream = ffmpeg.input(video_path, **input_args)
        
        if video_filter:
            stream = ffmpeg.filter(stream, "scale", video_filter)
        
        stream = ffmpeg.output(
            stream,
            output_path,
            vcodec="libx264",
            acodec="aac",
            **{"b:v": "2M", "b:a": "128k"}
        )
        
        ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
        
        # 6. Upload do vídeo final
        output_url = await upload_to_storage(output_path, video_id)
        
        # 7. Notificar Next.js
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json={
                "videoId": video_id,
                "outputUrl": output_url,
                "status": "completed"
            }, timeout=30.0)
        
        # 8. Limpar arquivos temporários
        os.remove(video_path)
        os.remove(srt_path)
        os.remove(output_path)
        
    except Exception as e:
        print(f"Error in rendering: {e}")
        
        # Notificar erro
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json={
                "videoId": video_id,
                "error": str(e),
                "status": "failed"
            }, timeout=30.0)

def build_subtitle_style(style: dict) -> str:
    """Construir string de estilo para FFmpeg"""
    # Converter cores hex para BGR
    def hex_to_bgr(hex_color):
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return f"{b:02X}{g:02X}{r:02X}"
    
    primary_color = hex_to_bgr(style.get("color", "#FFFFFF"))
    back_color = hex_to_bgr(style.get("backgroundColor", "#000000"))
    
    # Posição (2=bottom, 5=center, 8=top)
    position_map = {"bottom": 2, "center": 5, "top": 8}
    alignment = position_map.get(style.get("position", "bottom"), 2)
    
    return (
        f"FontName={style.get('fontFamily', 'Arial')},"
        f"FontSize={style.get('fontSize', 24)},"
        f"PrimaryColour=&H{primary_color}&,"
        f"BackColour=&H{back_color}&,"
        f"Alignment={alignment},"
        f"BorderStyle=3,"
        f"Outline={style.get('outlineWidth', 2)}"
    )
```

**utils.py**
```python
import httpx
import subprocess
import os
from datetime import timedelta

async def download_video(url: str, video_id: str) -> str:
    """Download vídeo do URL"""
    video_path = f"/tmp/video_{video_id}.mp4"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=300.0)
        with open(video_path, "wb") as f:
            f.write(response.content)
    
    return video_path

def extract_audio(video_path: str) -> str:
    """Extrair áudio do vídeo"""
    audio_path = video_path.replace(".mp4", ".mp3")
    
    command = [
        "ffmpeg",
        "-i", video_path,
        "-vn",  # Sem vídeo
        "-ar", "16000",  # Sample rate 16kHz
        "-ac", "1",  # Mono
        "-b:a", "64k",  # Bitrate 64k
        "-f", "mp3",
        audio_path
    ]
    
    subprocess.run(command, check=True, capture_output=True)
    return audio_path

def generate_srt_file(subtitles: list, video_id: str) -> str:
    """Gerar arquivo SRT"""
    srt_path = f"/tmp/subtitles_{video_id}.srt"
    
    srt_content = []
    for i, sub in enumerate(subtitles, start=1):
        start_time = format_timestamp(sub["start"])
        end_time = format_timestamp(sub["end"])
        
        srt_content.append(f"{i}")
        srt_content.append(f"{start_time} --> {end_time}")
        srt_content.append(sub["text"])
        srt_content.append("")  # Linha em branco
    
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_content))
    
    return srt_path

def format_timestamp(seconds: float) -> str:
    """Converter segundos para formato SRT (HH:MM:SS,mmm)"""
    td = timedelta(seconds=seconds)
    hours = td.seconds // 3600
    minutes = (td.seconds % 3600) // 60
    secs = td.seconds % 60
    millis = td.microseconds // 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

async def upload_to_storage(file_path: str, video_id: str) -> str:
    """Upload para Cloudflare R2 ou outro storage"""
    # Implementar upload para seu storage escolhido
    # Exemplo com Cloudflare R2, S3, etc
    
    # Retornar URL pública do arquivo
    return f"https://cdn.exemplo.com/videos/{video_id}_final.mp4"
```

**requirements.txt**
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
openai==1.3.5
httpx==0.25.1
ffmpeg-python==0.2.0
python-multipart==0.0.6
```

---

## Comunicação Entre Serviços

### Autenticação

```python
# Python verifica token em cada request
WORKER_SECRET = os.getenv("WORKER_SECRET")

def verify_secret(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401)
    
    token = authorization.split("Bearer ")[1]
    if token != WORKER_SECRET:
        raise HTTPException(status_code=401)
```

```typescript
// Next.js envia token
await fetch(WORKER_URL + '/transcribe', {
  headers: {
    'Authorization': `Bearer ${process.env.WORKER_SECRET}`
  }
});
```

### Fluxo de Webhook

```
Next.js                    Python
   │                          │
   │──── POST /transcribe ───→│
   │   (envia job)            │
   │                          │
   │                          │ (processa 2-5 min)
   │                          │
   │←─── POST /webhook ───────│
   │   (resultado)            │
   │                          │
   │ (salva no Postgres)      │
   │ (notifica usuário)       │
```

---

## Deploy e Infraestrutura

### Next.js (Vercel)

**1. Conectar repositório no Vercel Dashboard**

**2. Variáveis de Ambiente:**
```env
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Auth
NEXTAUTH_SECRET=seu-secret-aleatorio
NEXTAUTH_URL=https://seu-app.vercel.app

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Worker Python
WORKER_URL=https://seu-worker.railway.app
WORKER_SECRET=seu-secret-forte

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Notificações (Pusher)
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
```

**3. Deploy automático:** Git push → Vercel deploys

### Python (Railway)

**1. Criar conta no Railway**

**2. New Project → Deploy from GitHub**

**3. Selecionar repositório do worker**

**4. Variáveis de Ambiente:**
```env
# OpenAI
OPENAI_API_KEY=sk-...

# Segurança
WORKER_SECRET=seu-secret-forte

# Storage (mesmo do Next.js)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

**5. Railway detecta Python e instala dependências automaticamente**

**6. Expõe URL pública:** `https://seu-worker.railway.app`

### Postgres (Neon)

**1. Criar conta no Neon**

**2. Criar novo projeto**

**3. Copiar connection string**

**4. Adicionar no `.env` do Next.js**

```bash
# Rodar migrations
npx prisma migrate dev
npx prisma generate
```

### Storage (Cloudflare R2)

**1. Criar conta no Cloudflare**

**2. R2 → Create bucket**

**3. Copiar credenciais**

**4. Configurar CORS:**
```json
[
  {
    "AllowedOrigins": ["https://seu-app.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"]
  }
]
```

---

## Custos Estimados

### Para 100 Usuários (100 min/mês cada)

| Serviço | Custo Mensal |
|---------|--------------|
| **Vercel** (Hobby/Pro) | $0 - $20 |
| **Railway** (Python worker) | $5 - $10 |
| **Neon** (Postgres) | $0 |
| **Cloudflare R2** | $5 |
| **Whisper API** | $60 (10k min × $0.006) |
| **Pusher** (notificações) | $0 - $5 |
| **Total Base** | **~$70 - $100/mês** |

**+ Stripe fees:** 2.9% + $0.30 por transação

### Projeção com 1.000 Usuários

| Serviço | Custo Mensal |
|---------|--------------|
| Vercel Pro | $20 |
| Railway (scaled) | $20 - $30 |
| Neon Pro | $19 |
| Cloudflare R2 | $20 |
| Whisper API | $600 (100k min) |
| Pusher | $49 |
| **Total** | **~$730/mês** |

**MRR Esperado:** $9.900 (1k users × $9.90)  
**Margem:** ~92%

---

## Checklist de Implementação

### Fase 1: Setup Básico (Semana 1)

- [ ] Criar projeto Next.js
- [ ] Setup Prisma + Postgres (Neon)
- [ ] Implementar autenticação (NextAuth)
- [ ] Criar schema de banco de dados
- [ ] Setup Cloudflare R2 para storage
- [ ] Implementar upload de vídeos

### Fase 2: Microsserviço Python (Semana 2)

- [ ] Criar projeto FastAPI
- [ ] Implementar rota de transcrição
- [ ] Implementar rota de renderização
- [ ] Deploy no Railway
- [ ] Testar comunicação Next.js ↔ Python

### Fase 3: Editor de Legendas (Semana 3)

- [ ] Componente VideoPreview
- [ ] Editor de texto das legendas
- [ ] Editor de estilo (cor, fonte, posição)
- [ ] Timeline para trim
- [ ] Preview em tempo real (CSS)

### Fase 4: Integração Stripe (Semana 4)

- [ ] Setup Stripe
- [ ] Página de pricing
- [ ] Checkout flow
- [ ] Webhooks do Stripe
- [ ] Customer portal
- [ ] Verificação de limites

### Fase 5: Notificações & UX (Semana 5)

- [ ] Setup Pusher
- [ ] Notificações real-time
- [ ] Loading states
- [ ] Error handling
- [ ] Dashboard com lista de vídeos

### Fase 6: Polimento & Deploy (Semana 6)

- [ ] Testes end-to-end
- [ ] Otimizações de performance
- [ ] SEO & meta tags
- [ ] Deploy final em produção
- [ ] Documentação

---

## Recursos Adicionais

### Documentação Oficial

- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Stripe](https://stripe.com/docs)
- [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [FFmpeg](https://ffmpeg.org/documentation.html)

### Ferramentas Úteis

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Railway Dashboard](https://railway.app/dashboard)
- [Neon Console](https://console.neon.tech/)
- [Cloudflare R2](https://dash.cloudflare.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)

---

## Perguntas Frequentes

**P: Por que não usar apenas Next.js?**  
R: Vercel tem timeout de 60 segundos. Transcrição e renderização levam 2-15 minutos.

**P: Por que Python e não Node.js para o worker?**  
R: FFmpeg funciona melhor com Python. Whisper tem ótimas libs em Python. Mais exemplos disponíveis.

**P: Preciso de Redis/RabbitMQ para filas?**  
R: Não! Para MVP, HTTP + webhooks é suficiente. Background tasks do FastAPI gerenciam filas simples.

**P: E se Python cair durante o processamento?**  
R: Implementar retry no Next.js ou usar Railway's Health Checks para restart automático.

**P: Consigo trocar de Whisper para AssemblyAI depois?**  
R: Sim! É só trocar a chamada de API no `transcription.py`. O resto permanece igual.

**P: Preciso de Kubernetes?**  
R: Não! Railway/Render escalam automaticamente. K8s é overkill para esse caso.

---

## Conclusão

Esta arquitetura permite criar um SaaS de legendagem profissional com:

✅ **Custos otimizados:** ~$70-100/mês para começar  
✅ **Desenvolvimento rápido:** 4-6 semanas para MVP  
✅ **Fácil manutenção:** Python tem apenas 2 rotas  
✅ **Escalável:** Cada serviço escala independentemente  
✅ **Confiável:** Separação evita pontos únicos de falha  

**Next.js faz 90% do trabalho (interface, CRUD, Stripe).**  
**Python faz 10% (apenas processamento pesado).**

Boa sorte com o desenvolvimento! 🚀
