import os
import subprocess
import httpx
import shutil
import time
from typing import Dict
from utils import download_video, cleanup_files


def calculate_frame_count(duration_seconds: float) -> int:
    """
    Calcula número de frames para filmstrip baseado na duração do vídeo.

    Lógica adaptativa:
    - Vídeos curtos (0-30s): 15 frames
    - Vídeos médios (30s-3min): 20 frames
    - Vídeos longos (3-10min): 25 frames
    - Vídeos muito longos (>10min): 30 frames (máximo)

    Args:
        duration_seconds: Duração do vídeo em segundos

    Returns:
        Número de frames a extrair
    """
    if duration_seconds <= 30:
        return 15
    elif duration_seconds <= 180:
        return 20
    elif duration_seconds <= 600:
        return 25
    else:
        return 30


def get_total_frames_ffprobe(video_path: str) -> int:
    """
    Obtém o número total de frames usando ffprobe.

    Args:
        video_path: Caminho do arquivo de vídeo

    Returns:
        Número total de frames no vídeo
    """
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'error',
                '-select_streams', 'v:0',
                '-count_packets',
                '-show_entries', 'stream=nb_read_packets',
                '-of', 'csv=p=0',
                video_path
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and result.stdout.strip():
            return int(result.stdout.strip())
        else:
            # Fallback: estimar baseado em duração e fps
            print(f"[Filmstrip] Warning: couldn't get frame count, using fallback estimation")
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                 '-show_entries', 'stream=duration,r_frame_rate',
                 '-of', 'default=noprint_wrappers=1:nokey=1', video_path],
                capture_output=True, text=True, timeout=30
            )
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                fps_str = lines[0]  # ex: "30/1"
                duration = float(lines[1])
                fps = eval(fps_str) if '/' in fps_str else float(fps_str)
                return int(duration * fps)
            return 1000  # Fallback conservador

    except Exception as e:
        print(f"[Filmstrip] Error getting frame count: {e}")
        return 1000  # Fallback conservador


def generate_filmstrip_sprite(
    video_path: str,
    output_path: str,
    frame_count: int = 25,
    frame_width: int = 160,
    frame_height: int = 90
) -> Dict:
    """
    Gera sprite sheet horizontal de filmstrip usando FFmpeg.

    Usa o comando FFmpeg com filtros: select -> scale -> tile
    para criar uma única imagem horizontal com todos os frames.

    Args:
        video_path: Caminho do vídeo de entrada
        output_path: Caminho para salvar o filmstrip
        frame_count: Número de frames a extrair
        frame_width: Largura de cada frame
        frame_height: Altura de cada frame

    Returns:
        Dicionário com metadata do filmstrip gerado
    """
    print(f"[Filmstrip] Generating sprite sheet with {frame_count} frames...")

    # 1. Obter total de frames do vídeo
    total_frames = get_total_frames_ffprobe(video_path)
    print(f"[Filmstrip] Video has {total_frames} total frames")

    # 2. Calcular intervalo: selecionar 1 frame a cada N frames
    frame_interval = max(1, total_frames // frame_count)
    print(f"[Filmstrip] Extracting 1 frame every {frame_interval} frames")

    # 3. FFmpeg command: select frames -> scale -> tile horizontalmente
    #
    # Breakdown do comando:
    # - select='not(mod(n,INTERVAL))': Seleciona 1 frame a cada INTERVAL frames
    # - scale=WIDTHxHEIGHT:flags=bicubic: Redimensiona cada frame (bicubic = alta qualidade)
    # - tile=COLUMNSx1: Arranja frames horizontalmente (Nx1 = N colunas, 1 linha)
    # - frames:v 1: Output é 1 única imagem
    # - q:v 2: Qualidade JPEG alta (escala 2-31, onde 2 = melhor)

    command = [
        'ffmpeg',
        '-i', video_path,
        '-vf', f"select='not(mod(n\\,{frame_interval}))',scale={frame_width}:{frame_height}:flags=bicubic,tile={frame_count}x1",
        '-frames:v', '1',
        '-q:v', '2',  # Alta qualidade JPEG
        '-y',
        output_path
    ]

    print(f"[Filmstrip] Running FFmpeg command...")
    print(f"[Filmstrip] Command: {' '.join(command)}")

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120  # Timeout de 2 minutos para vídeos longos
        )

        if result.returncode != 0:
            raise Exception(f"FFmpeg failed with code {result.returncode}: {result.stderr}")

        if not os.path.exists(output_path):
            raise Exception(f"Output file not created: {output_path}")

        file_size = os.path.getsize(output_path)
        print(f"[Filmstrip] ✓ Generated {output_path} ({file_size} bytes)")

        # Calcular dimensões totais do sprite sheet
        total_width = frame_count * frame_width

        return {
            "filmstrip_path": output_path,
            "frameCount": frame_count,
            "frameWidth": frame_width,
            "frameHeight": frame_height,
            "totalWidth": total_width,
            "fileSize": file_size
        }

    except subprocess.TimeoutExpired:
        raise Exception(f"FFmpeg timed out after 120 seconds")
    except Exception as e:
        print(f"[Filmstrip] ✗ Error generating filmstrip: {e}")
        raise


def salvar_filmstrip_local(filmstrip_path: str, video_id: str) -> str:
    """
    Salva filmstrip na pasta pública do Next.js.

    Args:
        filmstrip_path: Caminho do filmstrip gerado (ex: /tmp/filmstrip.jpg)
        video_id: ID do vídeo

    Returns:
        URL para acessar (ex: /uploads/thumbnails/video123/filmstrip.jpg)
    """
    # Converter caminho WSL para Windows se necessário
    # Worker roda no Windows, então usar caminho Windows
    pasta_windows = f"C:\\allsaas\\subs\\public\\uploads\\thumbnails\\{video_id}"

    try:
        # Criar pasta se não existir
        os.makedirs(pasta_windows, exist_ok=True)
        print(f"[Filmstrip] Pasta criada/verificada: {pasta_windows}")

        # Copiar arquivo
        destino = os.path.join(pasta_windows, "filmstrip.jpg")
        shutil.copy(filmstrip_path, destino)

        # Verificar se arquivo existe
        if os.path.exists(destino):
            file_size = os.path.getsize(destino)
            print(f"[Filmstrip] ✓ Salvo localmente: {destino} ({file_size} bytes)")
        else:
            raise Exception(f"Arquivo não foi criado: {destino}")

    except Exception as e:
        print(f"[Filmstrip] ✗ Erro ao salvar filmstrip: {e}")
        raise

    # Retornar URL (Next.js serve /public como /)
    return f"/uploads/thumbnails/{video_id}/filmstrip.jpg"


async def process_filmstrip_generation(
    video_id: str,
    video_url: str,
    duration: float,
    webhook_url: str
):
    """
    Processa a geração completa do filmstrip.

    Fluxo:
    1. Download do vídeo
    2. Calcula número de frames baseado na duração
    3. Gera sprite sheet com FFmpeg
    4. Salva na pasta pública
    5. Webhook para Next.js com URL e metadata
    6. Cleanup de arquivos temporários

    Args:
        video_id: ID do vídeo no banco
        video_url: URL do vídeo para download
        duration: Duração em segundos
        webhook_url: URL do webhook Next.js
    """
    temp_dir = f"/tmp/filmstrip_{video_id}"
    os.makedirs(temp_dir, exist_ok=True)
    video_path = None

    try:
        print(f"[Filmstrip] Starting generation for video {video_id}")
        print(f"[Filmstrip] Video duration: {duration:.1f}s")

        # 1. Download do vídeo
        print(f"[Filmstrip] Downloading video from {video_url}")
        download_start = time.time()
        video_path = await download_video(video_url, video_id)
        download_time = time.time() - download_start
        print(f"[Filmstrip] ✓ Downloaded in {download_time:.1f}s")

        # 2. Calcular número de frames adaptativo
        frame_count = calculate_frame_count(duration)

        # Determinar estratégia para logging
        if duration <= 30:
            strategy = "curtos (15 frames)"
        elif duration <= 180:
            strategy = "médios (20 frames)"
        elif duration <= 600:
            strategy = "longos (25 frames)"
        else:
            strategy = "muito longos (30 frames)"

        print(f"[Filmstrip] Gerando filmstrip para vídeos {strategy}")

        # 3. Gerar sprite sheet
        filmstrip_path = os.path.join(temp_dir, "filmstrip.jpg")
        generation_start = time.time()

        metadata = generate_filmstrip_sprite(
            video_path,
            filmstrip_path,
            frame_count=frame_count,
            frame_width=160,
            frame_height=90
        )

        generation_time = time.time() - generation_start
        print(f"[Filmstrip] ✓ Generation completed in {generation_time:.1f}s")

        # 4. Salvar localmente
        filmstrip_url = salvar_filmstrip_local(filmstrip_path, video_id)

        # 5. Preparar payload do webhook
        payload = {
            "videoId": video_id,
            "filmstripUrl": filmstrip_url,
            "metadata": {
                "frameCount": metadata["frameCount"],
                "frameWidth": metadata["frameWidth"],
                "frameHeight": metadata["frameHeight"],
                "totalWidth": metadata["totalWidth"],
                "fileSize": metadata["fileSize"]
            },
            "status": "completed"
        }

        # 6. Enviar webhook para Next.js
        webhook_timeout = min(120.0, max(30.0, duration / 10 + 30.0))

        print(f"[Filmstrip] Enviando webhook com timeout de {webhook_timeout}s...")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                timeout=webhook_timeout
            )
            response.raise_for_status()
            print(f"[Filmstrip] ✓ Webhook sent successfully")

        # 7. Cleanup
        if video_path:
            cleanup_files(video_path, filmstrip_path)
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as cleanup_err:
                print(f"[Filmstrip] Warning: cleanup error: {cleanup_err}")

        total_time = download_time + generation_time
        print(f"[Filmstrip] ✓ Completed for video {video_id} in {total_time:.1f}s total")

    except Exception as e:
        print(f"[Filmstrip] ✗ Error in generation for {video_id}: {e}")

        # Notificar erro via webhook
        try:
            webhook_timeout = min(120.0, max(30.0, duration / 10 + 30.0)) if duration else 60.0
        except:
            webhook_timeout = 60.0

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
            print(f"[Filmstrip] Failed to send error webhook: {webhook_error}")

        # Cleanup em caso de erro
        if video_path:
            cleanup_files(video_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
