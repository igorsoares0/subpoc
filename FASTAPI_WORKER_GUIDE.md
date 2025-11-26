# Guia: Microsserviço FastAPI para Processamento de Vídeos

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Por Que FastAPI?](#por-que-fastapi)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Implementação Completa](#implementação-completa)
5. [Modificações no Next.js](#modificações-no-nextjs)
6. [Deploy no Railway](#deploy-no-railway)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Testando Localmente](#testando-localmente)
9. [Troubleshooting](#troubleshooting)

---

## Visão Geral

### Problema Atual

O Next.js está processando:
- **Transcrição:** FFmpeg + Whisper API (2-5 minutos)
- **Renderização:** FFmpeg + hardcoded subtitles (5-15 minutos)

**Vercel Serverless Limits:**
- Hobby: 60 segundos timeout
- Pro: 300 segundos timeout

**Resultado:** Vai falhar em produção para vídeos > 1 minuto

### Solução

Criar microsserviço FastAPI separado que:
- Processa operações longas sem timeout
- Usa background tasks
- Notifica Next.js via webhook quando termina
- Pode escalar independentemente

### Fluxo de Trabalho

```
┌─────────────┐                  ┌──────────────┐
│   Next.js   │                  │   FastAPI    │
│  (Vercel)   │                  │  (Railway)   │
└──────┬──────┘                  └──────┬───────┘
       │                                │
       │ 1. POST /transcribe            │
       │ (videoId, videoUrl, webhook)   │
       ├───────────────────────────────>│
       │                                │
       │ 2. 200 OK {"processing"}       │
       │<───────────────────────────────┤
       │                                │
       │                                │ 3. Download video
       │                                │ 4. Extract audio
       │                                │ 5. Call Whisper
       │                                │ (2-5 minutes)
       │                                │
       │ 6. POST /webhook (result)      │
       │<───────────────────────────────┤
       │                                │
       │ 7. Save to Postgres            │
       │ 8. Notify user                 │
       │                                │
```

---

## Por Que FastAPI?

✅ **Vantagens:**
- Async nativo (melhor que Flask)
- Background tasks integradas
- Documentação automática (Swagger)
- Tipagem com Pydantic
- Rápido e moderno
- Deploy simples no Railway

✅ **Python é melhor para:**
- FFmpeg (bibliotecas maduras)
- Whisper/OpenAI (exemplos abundantes)
- Processamento de vídeo

---

## Estrutura do Projeto

```
worker/
├── main.py                 # FastAPI app principal
├── transcription.py        # Lógica de transcrição
├── rendering.py            # Lógica de renderização
├── utils.py                # Helpers (download, upload, SRT)
├── config.py               # Configurações e variáveis
├── requirements.txt        # Dependências Python
├── .env                    # Variáveis de ambiente (local)
└── README.md               # Documentação do worker
```

---

## Implementação Completa

### 1. Criar Pasta do Worker

```bash
# Na raiz do seu projeto
mkdir worker
cd worker
```

### 2. `requirements.txt`

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
openai==1.10.0
httpx==0.26.0
ffmpeg-python==0.2.0
python-multipart==0.0.6
pydantic==2.5.3
pydantic-settings==2.1.0
python-dotenv==1.0.0
```

### 3. `config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str

    # Segurança
    worker_secret: str

    # Storage (se usar S3/R2)
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None

    # Ambiente
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()
```

### 4. `utils.py`

```python
import httpx
import subprocess
import os
import tempfile
from datetime import timedelta
from pathlib import Path

async def download_video(url: str, video_id: str) -> str:
    """Download vídeo do URL para arquivo temporário"""
    temp_dir = tempfile.gettempdir()
    video_path = os.path.join(temp_dir, f"video_{video_id}.mp4")

    print(f"Downloading video from {url} to {video_path}")

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.get(url)
        response.raise_for_status()

        with open(video_path, "wb") as f:
            f.write(response.content)

    print(f"Video downloaded successfully: {os.path.getsize(video_path)} bytes")
    return video_path

def extract_audio(video_path: str) -> str:
    """Extrair áudio do vídeo usando FFmpeg"""
    audio_path = video_path.replace(".mp4", ".mp3")

    print(f"Extracting audio from {video_path} to {audio_path}")

    command = [
        "ffmpeg",
        "-i", video_path,
        "-vn",                # Sem vídeo
        "-ar", "16000",       # Sample rate 16kHz (ótimo para Whisper)
        "-ac", "1",           # Mono
        "-b:a", "64k",        # Bitrate 64k
        "-f", "mp3",
        "-y",                 # Overwrite output
        audio_path
    ]

    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True
    )

    print(f"Audio extracted successfully: {os.path.getsize(audio_path)} bytes")
    return audio_path

def generate_srt_file(subtitles: list[dict], video_id: str) -> str:
    """Gerar arquivo SRT a partir de legendas"""
    temp_dir = tempfile.gettempdir()
    srt_path = os.path.join(temp_dir, f"subtitles_{video_id}.srt")

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

    print(f"SRT file generated: {srt_path}")
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
    """
    Upload arquivo para storage (S3/R2/etc)

    Para MVP, pode retornar URL local ou implementar upload real.
    """
    # TODO: Implementar upload para seu storage (S3, R2, etc)
    # Por enquanto, retorna caminho fictício

    filename = f"{video_id}_rendered.mp4"

    # Exemplo com S3/R2 (descomentar quando configurar):
    """
    import boto3
    from config import get_settings

    settings = get_settings()

    s3_client = boto3.client(
        's3',
        endpoint_url=f'https://{settings.r2_account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name='auto'
    )

    with open(file_path, 'rb') as f:
        s3_client.upload_fileobj(
            f,
            settings.r2_bucket_name,
            filename,
            ExtraArgs={'ContentType': 'video/mp4'}
        )

    return f"https://your-cdn-url.com/{filename}"
    """

    # Por enquanto, retorna URL placeholder
    return f"https://cdn.example.com/videos/{filename}"

def cleanup_files(*file_paths: str):
    """Deletar arquivos temporários"""
    for file_path in file_paths:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Cleaned up: {file_path}")
        except Exception as e:
            print(f"Error cleaning up {file_path}: {e}")
```

### 5. `transcription.py`

```python
import openai
import httpx
from config import get_settings
from utils import download_video, extract_audio, cleanup_files

settings = get_settings()

async def process_transcription(
    video_id: str,
    video_url: str,
    webhook_url: str
):
    """
    Processar transcrição do vídeo

    1. Download do vídeo
    2. Extrair áudio com FFmpeg
    3. Enviar para Whisper API
    4. Formatar resultado em legendas
    5. Notificar Next.js via webhook
    6. Limpar arquivos temporários
    """
    video_path = None
    audio_path = None

    try:
        print(f"[Transcription] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Extrair áudio
        audio_path = extract_audio(video_path)

        # 3. Transcrever com Whisper
        print(f"[Transcription] Sending to Whisper API...")
        client = openai.OpenAI(api_key=settings.openai_api_key)

        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language="pt",  # Português
                timestamp_granularities=["segment"]
            )

        print(f"[Transcription] Whisper returned {len(transcription.segments)} segments")

        # 4. Formatar resultado
        subtitles = [
            {
                "id": i,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip()
            }
            for i, seg in enumerate(transcription.segments, start=1)
        ]

        print(f"[Transcription] Formatted {len(subtitles)} subtitles")

        # 5. Notificar Next.js
        print(f"[Transcription] Sending webhook to {webhook_url}")
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "subtitles": subtitles,
                    "status": "completed"
                },
                timeout=30.0
            )
            response.raise_for_status()

        print(f"[Transcription] Success! Video {video_id} completed")

    except Exception as e:
        print(f"[Transcription] Error processing video {video_id}: {e}")

        # Notificar erro ao Next.js
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": str(e),
                        "status": "failed"
                    },
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"[Transcription] Failed to send error webhook: {webhook_error}")

    finally:
        # 6. Limpar arquivos temporários
        if video_path or audio_path:
            cleanup_files(video_path or "", audio_path or "")
```

### 6. `rendering.py`

```python
import subprocess
import httpx
from config import get_settings
from utils import (
    download_video,
    generate_srt_file,
    upload_to_storage,
    cleanup_files
)

settings = get_settings()

def hex_to_ffmpeg_color(hex_color: str, opacity: float = 1.0) -> str:
    """Converter cor hex para formato FFmpeg ASS (&HAABBGGRR)"""
    hex_color = hex_color.lstrip('#')

    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)

    # ASS Alpha: 00 = opaque, FF = transparent
    a = int((1 - opacity) * 255)

    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}"

def build_subtitle_style(style: dict) -> str:
    """Construir força_style string para FFmpeg"""
    primary_color = hex_to_ffmpeg_color(style.get("color", "#FFFFFF"), 1)
    outline_color = hex_to_ffmpeg_color(style.get("outlineColor", "#000000"), 1)
    back_color = hex_to_ffmpeg_color(
        style.get("backgroundColor", "#000000"),
        style.get("backgroundOpacity", 0.8)
    )

    font_name = style.get("fontFamily", "Arial")
    font_size = style.get("fontSize", 24)
    outline_width = style.get("outlineWidth", 2)

    # BorderStyle: 1 = outline, 3 = opaque box
    border_style = 3 if style.get("backgroundOpacity", 0.8) > 0 else 1

    return (
        f"FontName={font_name},"
        f"FontSize={font_size},"
        f"PrimaryColour={primary_color},"
        f"OutlineColour={outline_color if border_style == 1 else back_color},"
        f"BackColour={back_color},"
        f"BorderStyle={border_style},"
        f"Outline={outline_width}"
    )

async def process_rendering(
    video_id: str,
    video_url: str,
    subtitles: list[dict],
    style: dict,
    format_type: str | None,
    trim: dict | None,
    overlays: list[dict],
    webhook_url: str
):
    """
    Processar renderização do vídeo final

    1. Download do vídeo
    2. Gerar arquivo SRT
    3. Construir comando FFmpeg
    4. Renderizar vídeo com legendas hardcoded
    5. Upload do resultado
    6. Notificar Next.js via webhook
    7. Limpar arquivos temporários
    """
    video_path = None
    srt_path = None
    output_path = None

    try:
        print(f"[Rendering] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Gerar arquivo SRT
        srt_path = generate_srt_file(subtitles, video_id)

        # 3. Path do vídeo final
        import tempfile
        import os
        output_path = os.path.join(tempfile.gettempdir(), f"rendered_{video_id}.mp4")

        # 4. Construir filtros FFmpeg
        filters = []

        # Formatos para redes sociais
        if format_type == "instagram_story" or format_type == "tiktok":
            filters.append(
                "scale=1080:1920:force_original_aspect_ratio=decrease,"
                "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
            )
        elif format_type == "instagram_feed":
            filters.append(
                "scale=1080:1080:force_original_aspect_ratio=decrease,"
                "pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black"
            )
        elif format_type == "youtube":
            filters.append(
                "scale=1920:1080:force_original_aspect_ratio=decrease,"
                "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"
            )

        # Aplicar legendas com estilo
        subtitle_style = build_subtitle_style(style)
        subtitle_filter = f"subtitles={srt_path}:force_style='{subtitle_style}'"
        filters.append(subtitle_filter)

        # Combinar filtros
        video_filter = ",".join(filters) if filters else None

        # 5. Construir comando FFmpeg
        command = ["ffmpeg", "-i", video_path]

        # Trim (se especificado)
        if trim and trim.get("start") is not None:
            command.extend(["-ss", str(trim["start"])])
        if trim and trim.get("end") is not None:
            command.extend(["-to", str(trim["end"])])

        # Filtros de vídeo
        if video_filter:
            command.extend(["-vf", video_filter])

        # Codec e qualidade
        command.extend([
            "-c:v", "libx264",
            "-preset", "medium",  # medium = boa qualidade/velocidade
            "-crf", "23",         # 23 = boa qualidade (0-51, menor = melhor)
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",  # Otimizar para streaming
            "-y",  # Overwrite output
            output_path
        ])

        print(f"[Rendering] FFmpeg command: {' '.join(command)}")

        # 6. Executar FFmpeg
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True
        )

        print(f"[Rendering] Video rendered successfully: {output_path}")

        # 7. Upload do vídeo final
        output_url = await upload_to_storage(output_path, video_id)

        print(f"[Rendering] Video uploaded to: {output_url}")

        # 8. Notificar Next.js
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "outputUrl": output_url,
                    "status": "completed"
                },
                timeout=30.0
            )
            response.raise_for_status()

        print(f"[Rendering] Success! Video {video_id} completed")

    except Exception as e:
        print(f"[Rendering] Error processing video {video_id}: {e}")

        # Notificar erro ao Next.js
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": str(e),
                        "status": "failed"
                    },
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"[Rendering] Failed to send error webhook: {webhook_error}")

    finally:
        # 9. Limpar arquivos temporários
        cleanup_files(
            video_path or "",
            srt_path or "",
            output_path or ""
        )
```

### 7. `main.py`

```python
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from pydantic import BaseModel
from config import get_settings
from transcription import process_transcription
from rendering import process_rendering

app = FastAPI(
    title="Video Subtitle Worker",
    description="Microsserviço para transcrição e renderização de vídeos",
    version="1.0.0"
)

settings = get_settings()

# Modelos de requisição
class TranscribeRequest(BaseModel):
    videoId: str
    videoUrl: str
    webhookUrl: str

class RenderRequest(BaseModel):
    videoId: str
    videoUrl: str
    subtitles: list[dict]
    style: dict
    format: str | None = None
    trim: dict | None = None
    overlays: list[dict] = []
    webhookUrl: str

# Middleware de autenticação
def verify_secret(authorization: str = Header(None)):
    """Verificar token de segurança"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header format"
        )

    token = authorization.split("Bearer ")[1]
    if token != settings.worker_secret:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

# Rotas
@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "service": "video-subtitle-worker",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """Health check detalhado"""
    return {
        "status": "healthy",
        "environment": settings.environment
    }

@app.post("/transcribe")
async def transcribe(
    request: TranscribeRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint de transcrição

    Recebe vídeo, processa em background e notifica via webhook
    """
    verify_secret(authorization)

    # Adicionar à fila de background tasks
    background_tasks.add_task(
        process_transcription,
        request.videoId,
        request.videoUrl,
        request.webhookUrl
    )

    return {
        "status": "processing",
        "videoId": request.videoId,
        "message": "Transcription started in background"
    }

@app.post("/render")
async def render(
    request: RenderRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint de renderização

    Recebe vídeo + configurações, renderiza em background e notifica via webhook
    """
    verify_secret(authorization)

    # Adicionar à fila de background tasks
    background_tasks.add_task(
        process_rendering,
        request.videoId,
        request.videoUrl,
        request.subtitles,
        request.style,
        request.format,
        request.trim,
        request.overlays,
        request.webhookUrl
    )

    return {
        "status": "processing",
        "videoId": request.videoId,
        "message": "Rendering started in background"
    }

# Para desenvolvimento local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
```

### 8. `.env` (para desenvolvimento local)

```env
# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Segurança
WORKER_SECRET=seu-secret-super-forte-aqui

# Storage (opcional - para produção)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Ambiente
ENVIRONMENT=development
```

### 9. `README.md` (do worker)

```markdown
# Video Subtitle Worker

Microsserviço FastAPI para processamento de vídeos.

## Instalação

```bash
pip install -r requirements.txt
```

## Desenvolvimento

```bash
uvicorn main:app --reload
```

Acesse: http://localhost:8000/docs

## Deploy

Railway detecta automaticamente e faz deploy.
```

---

## Modificações no Next.js

### 1. Criar rotas de webhook

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

      console.error(`Transcription failed for ${videoId}:`, error)

      return NextResponse.json({ success: false, error })
    }

    // Salvar legendas
    await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        subtitles,
        status: "ready"
      }
    })

    console.log(`Transcription completed for ${videoId}: ${subtitles.length} subtitles`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    )
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

      console.error(`Rendering failed for ${videoId}:`, error)

      return NextResponse.json({ success: false, error })
    }

    // Salvar URL do vídeo renderizado
    await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        outputUrl,
        status: "completed"
      }
    })

    console.log(`Rendering completed for ${videoId}: ${outputUrl}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    )
  }
}
```

### 2. Modificar rota de transcrição

**`app/api/videos/[id]/transcribe/route.ts`** (SUBSTITUIR TODO O CONTEÚDO)

```typescript
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verificar ownership
    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    // Atualizar status para transcribing
    await prisma.videoProject.update({
      where: { id: id },
      data: { status: "transcribing" }
    })

    // Enviar para worker FastAPI
    const workerUrl = process.env.WORKER_URL
    const workerSecret = process.env.WORKER_SECRET

    if (!workerUrl || !workerSecret) {
      throw new Error("Worker not configured")
    }

    // Construir URL completa do vídeo
    const videoUrl = video.videoUrl.startsWith('http')
      ? video.videoUrl
      : `${process.env.NEXT_PUBLIC_APP_URL}${video.videoUrl}`

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/transcription`

    await fetch(`${workerUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`
      },
      body: JSON.stringify({
        videoId: id,
        videoUrl: videoUrl,
        webhookUrl: webhookUrl
      })
    })

    return NextResponse.json({
      success: true,
      status: "processing",
      message: "Transcription started"
    })
  } catch (error) {
    console.error("Error starting transcription:", error)

    return NextResponse.json(
      { error: "Failed to start transcription" },
      { status: 500 }
    )
  }
}
```

### 3. Modificar rota de renderização

**`app/api/videos/[id]/render/route.ts`** (SUBSTITUIR O POST)

```typescript
// Manter os imports e helpers existentes...
// Substituir apenas a função POST:

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verificar ownership
    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    if (!video.subtitles || (video.subtitles as any[]).length === 0) {
      return NextResponse.json(
        { error: "No subtitles to render" },
        { status: 400 }
      )
    }

    // Atualizar status para rendering
    await prisma.videoProject.update({
      where: { id: id },
      data: { status: "rendering" }
    })

    // Enviar para worker FastAPI
    const workerUrl = process.env.WORKER_URL
    const workerSecret = process.env.WORKER_SECRET

    if (!workerUrl || !workerSecret) {
      throw new Error("Worker not configured")
    }

    // Construir URL completa do vídeo
    const videoUrl = video.videoUrl.startsWith('http')
      ? video.videoUrl
      : `${process.env.NEXT_PUBLIC_APP_URL}${video.videoUrl}`

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/render-complete`

    await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`
      },
      body: JSON.stringify({
        videoId: id,
        videoUrl: videoUrl,
        subtitles: video.subtitles,
        style: video.subtitleStyle || {},
        format: video.format || null,
        trim: video.trim || null,
        overlays: video.overlays || [],
        webhookUrl: webhookUrl
      })
    })

    return NextResponse.json({
      success: true,
      status: "processing",
      message: "Rendering started"
    })
  } catch (error) {
    console.error("Error starting rendering:", error)

    return NextResponse.json(
      { error: "Failed to start rendering" },
      { status: 500 }
    )
  }
}
```

### 4. Adicionar variáveis de ambiente no Next.js

**`.env.local`**

```env
# Existentes...

# Worker FastAPI
WORKER_URL=http://localhost:8000  # Desenvolvimento
# WORKER_URL=https://seu-app.railway.app  # Produção
WORKER_SECRET=seu-secret-super-forte-aqui

# URL do app (para webhooks)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Desenvolvimento
# NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app  # Produção
```

---

## Deploy no Railway

### 1. Criar Conta no Railway

1. Acesse https://railway.app
2. Faça login com GitHub
3. Click em "New Project"

### 2. Deploy do Worker

**Opção A: Deploy direto do GitHub**

1. Push da pasta `worker/` para um repositório GitHub
2. No Railway: "New Project" → "Deploy from GitHub repo"
3. Selecione o repositório
4. Railway detecta Python automaticamente

**Opção B: Deploy via Railway CLI**

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Na pasta worker/
cd worker
railway init
railway up
```

### 3. Configurar Variáveis de Ambiente

No Railway Dashboard:

1. Clique no seu projeto
2. Vá em "Variables"
3. Adicione:

```
OPENAI_API_KEY=sk-...
WORKER_SECRET=seu-secret-forte
ENVIRONMENT=production
```

### 4. Copiar URL do Worker

1. No Railway, vá em "Settings" → "Domains"
2. Copie a URL gerada (ex: `https://seu-worker.railway.app`)
3. Adicione no `.env` do Next.js:

```env
WORKER_URL=https://seu-worker.railway.app
```

### 5. Configurar Vercel

No Vercel Dashboard:

1. Vá no seu projeto
2. Settings → Environment Variables
3. Adicione:

```
WORKER_URL=https://seu-worker.railway.app
WORKER_SECRET=seu-secret-forte
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

4. Redeploy

---

## Variáveis de Ambiente

### Next.js (Vercel)

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://seu-app.vercel.app

# Worker FastAPI
WORKER_URL=https://seu-worker.railway.app
WORKER_SECRET=seu-secret-super-forte-aqui

# App URL (para webhooks)
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app

# Storage, Stripe, etc...
```

### FastAPI Worker (Railway)

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Segurança
WORKER_SECRET=seu-secret-super-forte-aqui

# Ambiente
ENVIRONMENT=production

# Storage (opcional)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

---

## Testando Localmente

### 1. Iniciar FastAPI Worker

```bash
cd worker
pip install -r requirements.txt
uvicorn main:app --reload
```

Acesse: http://localhost:8000/docs (Swagger automático)

### 2. Iniciar Next.js

```bash
# Na raiz do projeto
npm run dev
```

### 3. Testar Transcrição

1. Faça upload de um vídeo
2. Click em "Transcribe"
3. Monitore logs:
   - Terminal FastAPI: veja o processamento
   - Terminal Next.js: veja o webhook

### 4. Testar Renderização

1. Após transcrição completa
2. Click em "Render"
3. Monitore logs em ambos os terminais

---

## Troubleshooting

### Erro: "Worker not configured"

**Causa:** Variáveis `WORKER_URL` ou `WORKER_SECRET` não definidas

**Solução:**
```bash
# .env.local
WORKER_URL=http://localhost:8000
WORKER_SECRET=test-secret-123
```

### Erro: "Invalid token" no FastAPI

**Causa:** `WORKER_SECRET` diferente entre Next.js e FastAPI

**Solução:** Use o mesmo valor em ambos

### Erro: FFmpeg não encontrado no Railway

**Causa:** FFmpeg não instalado no container

**Solução:** Criar `nixpacks.toml` na pasta `worker/`:

```toml
[phases.setup]
aptPkgs = ["ffmpeg"]
```

### Webhook não está sendo chamado

**Causa:** URL do webhook incorreta ou inacessível

**Solução:**
1. Verifique `NEXT_PUBLIC_APP_URL`
2. Em desenvolvimento local, use ngrok:
   ```bash
   ngrok http 3000
   # Use a URL do ngrok no NEXT_PUBLIC_APP_URL
   ```

### Transcrição demora muito

**Causa:** Normal para vídeos longos

**Expectativa:**
- 1 min de vídeo: ~30-60s de processamento
- 5 min de vídeo: ~2-4 min de processamento

### Renderização falha com erro de memória

**Causa:** Vídeo muito grande ou qualidade muito alta

**Solução:** No Railway, aumentar o plano ou otimizar:
```python
# rendering.py - reduzir qualidade
"-crf", "28",  # Aumentar de 23 para 28 (menor qualidade)
"-preset", "fast",  # Mais rápido, menor qualidade
```

---

## Próximos Passos

1. ✅ Implementar FastAPI worker
2. ✅ Modificar Next.js para usar worker
3. ✅ Deploy no Railway
4. 🔲 Implementar upload real para S3/R2 (opcional)
5. 🔲 Adicionar notificações real-time (Pusher/WebSocket)
6. 🔲 Implementar retry automático em caso de falha
7. 🔲 Adicionar fila de jobs (Redis/BullMQ) para alto volume

---

## Custos

### Railway (Worker Python)

- **Starter:** $5/mês (500h de execução)
- **Pro:** $20/mês (ilimitado)

### Whisper API

- $0.006 por minuto de áudio
- 100 minutos = $0.60

### Total MVP

- Railway: $5-10/mês
- Whisper: variável (pay-as-you-go)
- **Muito mais barato que processar no Vercel Pro!**

---

## Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Railway Docs](https://docs.railway.app/)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [FFmpeg Docs](https://ffmpeg.org/documentation.html)

---

**Pronto! Agora você tem um microsserviço robusto que não vai dar timeout. 🚀**
