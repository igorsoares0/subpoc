import os
import subprocess
import httpx
import shutil
import time
from typing import List, Dict
from utils import download_video, cleanup_files


def salvar_thumbnail_local(frame_path: str, video_id: str, frame_filename: str) -> str:
    """
    Salva thumbnail na pasta pública do Next.js

    Args:
        frame_path: Caminho do frame extraído (ex: /tmp/frame_0.0.jpg)
        video_id: ID do vídeo
        frame_filename: Nome do arquivo (ex: frame_0.0.jpg)

    Returns:
        URL para acessar (ex: /uploads/thumbnails/video123/frame_0.0.jpg)
    """
    # Converter caminho WSL para Windows se necessário
    # Worker roda no Windows, então usar caminho Windows
    pasta_windows = f"C:\\allsaas\\subs\\public\\uploads\\thumbnails\\{video_id}"

    try:
        # Criar pasta se não existir
        os.makedirs(pasta_windows, exist_ok=True)
        print(f"[Thumbnail] Pasta criada/verificada: {pasta_windows}")

        # Copiar arquivo
        destino = os.path.join(pasta_windows, frame_filename)
        shutil.copy(frame_path, destino)

        # Verificar se arquivo existe
        if os.path.exists(destino):
            file_size = os.path.getsize(destino)
            print(f"[Thumbnail] ✓ Salvo localmente: {destino} ({file_size} bytes)")
        else:
            raise Exception(f"Arquivo não foi criado: {destino}")

    except Exception as e:
        print(f"[Thumbnail] ✗ Erro ao salvar {frame_filename}: {e}")
        raise

    # Retornar URL (Next.js serve /public como /)
    return f"/uploads/thumbnails/{video_id}/{frame_filename}"


def calculate_thumbnail_positions(duration_seconds: float) -> List[float]:
    """
    Calcula timestamps para extração de thumbnails com lógica adaptativa OTIMIZADA.

    Regras adaptativas baseadas na duração:
    - Vídeos curtos (0-30s): 8-12 frames
    - Vídeos médios (30s-3min): 15-20 frames
    - Vídeos longos (3-10min): 20-25 frames
    - Vídeos muito longos (>10min): 25-30 frames MÁXIMO

    Args:
        duration_seconds: Duração do vídeo em segundos

    Returns:
        Lista de timestamps distribuídos uniformemente
    """
    # LIMITE MÁXIMO: 30 thumbnails (otimizado para performance)
    MAX_THUMBNAILS = 30

    # Lógica adaptativa baseada na duração
    if duration_seconds <= 30:
        # Vídeos curtos (0-30s): 8-12 frames
        count = min(12, max(8, int(duration_seconds / 3)))
    elif duration_seconds <= 180:
        # Vídeos médios (30s-3min): 15-20 frames
        count = min(20, max(15, int(duration_seconds / 10)))
    elif duration_seconds <= 600:
        # Vídeos longos (3-10min): 20-25 frames
        count = min(25, max(20, int(duration_seconds / 20)))
    else:
        # Vídeos muito longos (>10min): 25-30 frames MÁXIMO
        count = min(MAX_THUMBNAILS, max(25, int(duration_seconds / 30)))

    # Aplicar limite máximo absoluto
    count = min(MAX_THUMBNAILS, count)

    # Gera timestamps uniformemente distribuídos
    if count == 1:
        return [0.0]

    return [i * duration_seconds / (count - 1) for i in range(count)]


def extract_all_frames_at_once(
    video_path: str,
    timestamps: List[float],
    output_dir: str,
    width: int = 160,
    height: int = 90
) -> List[str]:
    """
    Extrai frames usando chamadas FFmpeg individuais MAS OTIMIZADAS.

    Abordagens testadas:
    - select filter com timestamps: FALHOU (eq(t,X) muito impreciso)
    - Esta abordagem: -ss ANTES de -i (rápido) + seek individual

    Args:
        video_path: Caminho do vídeo local
        timestamps: Lista de timestamps em segundos
        output_dir: Diretório onde salvar os frames
        width: Largura do thumbnail (padrão 160px)
        height: Altura do thumbnail (padrão 90px)

    Returns:
        Lista de caminhos dos frames gerados com sucesso
    """
    generated_files = []

    print(f"[Thumbnail] Extracting {len(timestamps)} frames with optimized seeking...")

    for i, timestamp in enumerate(timestamps):
        frame_file = os.path.join(output_dir, f"frame_{i+1:03d}.jpg")

        # SEEK PRECISO (frame-accurate):
        # -ss DEPOIS de -i = Decodifica até o frame exato
        # Mais lento mas ESSENCIAL para thumbnails distintas
        # Sem isso, todos os frames podem vir do mesmo keyframe

        command = [
            "ffmpeg",
            "-i", video_path,
            "-ss", str(timestamp),               # Seek PRECISO (frame exato)
            "-frames:v", "1",                    # Apenas 1 frame
            "-vf", f"scale={width}:{height}:flags=bicubic",
            "-q:v", "2",                         # Qualidade JPEG alta
            "-y",
            frame_file
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0 and os.path.exists(frame_file):
                generated_files.append(frame_file)
            else:
                print(f"[Thumbnail] Failed at {timestamp:.1f}s: {result.stderr[:100]}")

        except Exception as e:
            print(f"[Thumbnail] Error at {timestamp:.1f}s: {e}")
            continue

    print(f"[Thumbnail] ✓ Generated {len(generated_files)}/{len(timestamps)} frames")
    return generated_files


async def process_thumbnail_generation(
    video_id: str,
    video_url: str,
    duration: float,
    webhook_url: str
):
    """
    Processa a geração completa de thumbnails.

    Fluxo:
    1. Download do vídeo
    2. Calcula posições dos frames
    3. Extrai cada frame com FFmpeg
    4. Upload dos frames para R2
    5. Webhook para Next.js com URLs
    6. Cleanup de arquivos temporários

    Args:
        video_id: ID do vídeo no banco
        video_url: URL do vídeo para download
        duration: Duração em segundos
        webhook_url: URL do webhook Next.js
    """
    temp_dir = f"/tmp/thumbnails_{video_id}"
    os.makedirs(temp_dir, exist_ok=True)
    video_path = None

    try:
        print(f"[Thumbnail] Starting generation for video {video_id}")

        # 1. Download do vídeo
        print(f"[Thumbnail] Downloading video from {video_url}")
        video_path = await download_video(video_url, video_id)

        # 2. Calcular posições dos thumbnails
        timestamps = calculate_thumbnail_positions(duration)

        # Determinar estratégia para logging
        if duration <= 30:
            strategy = "curtos (1 frame a cada 2s)"
        elif duration <= 180:
            strategy = "médios (1 frame a cada 3s)"
        elif duration <= 600:
            strategy = "longos (1 frame a cada 5s)"
        else:
            strategy = "muito longos (1 frame a cada 8s)"

        print(f"[Thumbnail] Gerando {len(timestamps)} thumbnails para {duration:.1f}s de vídeo")
        print(f"[Thumbnail] Estratégia: vídeos {strategy}")

        # 3. Extrair TODOS os frames de uma vez (muito mais rápido e preciso)
        extraction_start_time = time.time()

        frame_paths = extract_all_frames_at_once(
            video_path,
            timestamps,
            temp_dir
        )

        extraction_time = time.time() - extraction_start_time
        print(f"[Thumbnail] ✓ Batch extraction completed in {extraction_time:.1f}s")

        # 4. Salvar cada frame localmente e montar lista de thumbnails
        thumbnails = []

        for i, (timestamp, frame_path) in enumerate(zip(timestamps, frame_paths)):
            # Gerar nome baseado no timestamp original
            frame_filename = f"frame_{timestamp:.1f}.jpg"

            try:
                thumbnail_url = salvar_thumbnail_local(frame_path, video_id, frame_filename)

                thumbnails.append({
                    "timestamp": timestamp,
                    "url": thumbnail_url
                })

            except Exception as save_error:
                print(f"[Thumbnail] Failed to save frame at {timestamp}s: {save_error}")
                continue

        # 5. Verificar se conseguiu gerar pelo menos alguns thumbnails
        if len(thumbnails) == 0:
            raise Exception("No thumbnails were generated successfully")

        print(f"[Thumbnail] Successfully generated {len(thumbnails)} thumbnails")

        # 6. Webhook para Next.js
        # Timeout adaptativo: vídeos longos podem demorar mais para processar
        # Mínimo 30s, máximo 120s baseado na duração
        webhook_timeout = min(120.0, max(30.0, duration / 10 + 30.0))
        
        payload = {
            "videoId": video_id,
            "thumbnails": thumbnails,
            "status": "completed"
        }

        print(f"[Thumbnail] Enviando webhook com timeout de {webhook_timeout}s...")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                timeout=webhook_timeout
            )
            response.raise_for_status()
            print(f"[Thumbnail] ✓ Webhook sent successfully to {webhook_url}")

        # 7. Cleanup (remover apenas arquivos temporários, thumbnails já foram copiados)
        if video_path:
            cleanup_files(video_path, *frame_paths)
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as cleanup_err:
                print(f"[Thumbnail] Warning: cleanup error: {cleanup_err}")

        print(f"[Thumbnail] ✓ Generation completed for video {video_id}")

    except Exception as e:
        print(f"[Thumbnail] ✗ Error in generation for {video_id}: {e}")

        # Notificar erro via webhook
        # Timeout adaptativo mesmo para erros (usar duration se disponível)
        try:
            webhook_timeout = min(120.0, max(30.0, duration / 10 + 30.0))
        except:
            webhook_timeout = 60.0  # Fallback se duration não estiver definida
            
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": str(e),
                        "status": "failed"
                    },
                    timeout=webhook_timeout
                )
        except Exception as webhook_error:
            print(f"[Thumbnail] Failed to send error webhook: {webhook_error}")

        # Cleanup em caso de erro
        if video_path:
            cleanup_files(video_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
