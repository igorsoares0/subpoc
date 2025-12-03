from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from config import get_settings
from transcription import process_transcription
from rendering import process_rendering
from thumbnail_generation import process_thumbnail_generation
from filmstrip_generation import process_filmstrip_generation
import os
import tempfile

app = FastAPI(
    title="Video Subtitle Worker",
    description="Microsserviço para transcrição e renderização de vídeos com legendas",
    version="1.0.0"
)

# CORS (permitir Next.js fazer requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique seu domínio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    logoOverlay: dict | None = None
    webhookUrl: str

class GenerateThumbnailsRequest(BaseModel):
    videoId: str
    videoUrl: str
    duration: float
    webhookUrl: str

class GenerateFilmstripRequest(BaseModel):
    videoId: str
    videoUrl: str
    duration: float
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
            detail="Invalid Authorization header format. Use: Bearer <token>"
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
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    """Health check detalhado"""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "service": "video-subtitle-worker"
    }

@app.post("/transcribe")
async def transcribe(
    request: TranscribeRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint de transcrição

    Recebe vídeo, processa em background com Whisper API e notifica via webhook

    Headers:
        Authorization: Bearer <WORKER_SECRET>

    Body:
        {
            "videoId": "id-do-video",
            "videoUrl": "https://url-do-video.mp4",
            "webhookUrl": "https://seu-app.com/api/webhooks/transcription"
        }

    Returns:
        {
            "status": "processing",
            "videoId": "id-do-video",
            "message": "Transcription started in background"
        }
    """
    verify_secret(authorization)

    print(f"[API] Transcription request received for video {request.videoId}")

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

    Recebe vídeo + configurações, renderiza com FFmpeg em background e notifica via webhook

    Headers:
        Authorization: Bearer <WORKER_SECRET>

    Body:
        {
            "videoId": "id-do-video",
            "videoUrl": "https://url-do-video.mp4",
            "subtitles": [{...}],
            "style": {...},
            "format": "instagram_story" | "tiktok" | "youtube" | null,
            "trim": {"start": 10, "end": 30} | null,
            "overlays": [],
            "webhookUrl": "https://seu-app.com/api/webhooks/render-complete"
        }

    Returns:
        {
            "status": "processing",
            "videoId": "id-do-video",
            "message": "Rendering started in background"
        }
    """
    verify_secret(authorization)

    print(f"[API] Rendering request received for video {request.videoId}")
    print(f"[API] Format: {request.format}, Subtitles: {len(request.subtitles)}")

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
        request.logoOverlay,
        request.webhookUrl
    )

    return {
        "status": "processing",
        "videoId": request.videoId,
        "message": "Rendering started in background"
    }

@app.post("/generate-thumbnails")
async def generate_thumbnails(
    request: GenerateThumbnailsRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint para geração de thumbnails de vídeo

    Extrai frames do vídeo usando lógica adaptativa:
    - Vídeos curtos (0-30s): 1 frame a cada 2s
    - Vídeos médios (30s-3min): 1 frame a cada 3s
    - Vídeos longos (3-10min): 1 frame a cada 5s
    - Vídeos muito longos (>10min): 1 frame a cada 8s (máx 100)

    Faz upload para local storage e notifica via webhook.

    Headers:
        Authorization: Bearer <WORKER_SECRET>

    Body:
        {
            "videoId": "clxxx123",
            "videoUrl": "http://localhost:3000/uploads/videos/video-123.mp4",
            "duration": 300.5,
            "webhookUrl": "http://localhost:3000/api/webhooks/thumbnails"
        }

    Returns:
        {
            "status": "processing",
            "videoId": "clxxx123",
            "message": "Generating thumbnails for 300.5s video"
        }
    """
    verify_secret(authorization)

    print(f"[API] Thumbnail generation request for video {request.videoId}")
    print(f"[API] Duration: {request.duration}s")

    # Processar em background
    background_tasks.add_task(
        process_thumbnail_generation,
        request.videoId,
        request.videoUrl,
        request.duration,
        request.webhookUrl
    )

    return {
        "status": "processing",
        "videoId": request.videoId,
        "message": f"Generating thumbnails for {request.duration}s video"
    }

@app.post("/generate-filmstrip")
async def generate_filmstrip(
    request: GenerateFilmstripRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint para geração de filmstrip (sprite sheet horizontal)

    Gera uma única imagem com múltiplos frames dispostos horizontalmente,
    otimizado para timeline de editores de vídeo.

    Lógica adaptativa baseada na duração:
    - Vídeos curtos (0-30s): 15 frames
    - Vídeos médios (30s-3min): 20 frames
    - Vídeos longos (3-10min): 25 frames
    - Vídeos muito longos (>10min): 30 frames (máximo)

    Headers:
        Authorization: Bearer <WORKER_SECRET>

    Body:
        {
            "videoId": "clxxx123",
            "videoUrl": "http://localhost:3000/uploads/videos/video-123.mp4",
            "duration": 300.5,
            "webhookUrl": "http://localhost:3000/api/webhooks/filmstrip-complete"
        }

    Returns:
        {
            "status": "processing",
            "videoId": "clxxx123",
            "message": "Generating filmstrip for 300.5s video"
        }
    """
    verify_secret(authorization)

    print(f"[API] Filmstrip generation request for video {request.videoId}")
    print(f"[API] Duration: {request.duration}s")

    # Processar em background
    background_tasks.add_task(
        process_filmstrip_generation,
        request.videoId,
        request.videoUrl,
        request.duration,
        request.webhookUrl
    )

    return {
        "status": "processing",
        "videoId": request.videoId,
        "message": f"Generating filmstrip for {request.duration}s video"
    }

@app.get("/download/{video_id}")
async def download_rendered_video(video_id: str):
    """
    Download do vídeo renderizado

    Serve o arquivo renderizado que está no /tmp do worker
    """
    try:
        # Caminho do arquivo renderizado
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"rendered_{video_id}.mp4")

        print(f"[Download] Request for video {video_id}")
        print(f"[Download] Looking for file: {file_path}")

        # Verificar se arquivo existe
        if not os.path.exists(file_path):
            print(f"[Download] File not found: {file_path}")
            raise HTTPException(status_code=404, detail="Rendered video not found")

        print(f"[Download] Serving file: {file_path} ({os.path.getsize(file_path)} bytes)")

        # Retornar arquivo
        return FileResponse(
            path=file_path,
            media_type="video/mp4",
            filename=f"{video_id}_subtitled.mp4"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Download] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Para desenvolvimento local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
