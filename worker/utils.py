import httpx
import subprocess
import os
import tempfile
import shutil
from datetime import timedelta
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from config import get_settings

async def download_video(url: str, video_id: str) -> str:
    """
    Download vídeo do URL ou copia de caminho local.

    Aceita tanto URLs completas (http://...) quanto caminhos relativos (/uploads/...).
    Para caminhos relativos, assume que o arquivo está em C:\\allsaas\\subs\\public\\
    """
    temp_dir = tempfile.gettempdir()
    video_path = os.path.join(temp_dir, f"video_{video_id}.mp4")

    print(f"[Download] Downloading video from {url} to {video_path}")

    # Verificar se é URL HTTP/HTTPS ou caminho local
    if url.startswith('http://') or url.startswith('https://'):
        # Download via HTTP
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.get(url)
            response.raise_for_status()

            with open(video_path, "wb") as f:
                f.write(response.content)
    else:
        # Caminho local relativo - copiar arquivo
        # Assumir que caminhos como /uploads/videos/... estão em C:\allsaas\subs\public\
        local_path = url.lstrip('/')  # Remove barra inicial
        full_path = os.path.join('C:\\allsaas\\subs\\public', local_path)

        print(f"[Download] Local file detected: {full_path}")

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Video file not found: {full_path}")

        # Copiar arquivo para temp
        shutil.copy(full_path, video_path)
        print(f"[Download] Copied local file to temp")

    print(f"[Download] Video ready: {os.path.getsize(video_path)} bytes")
    return video_path

def extract_audio(video_path: str) -> str:
    """Extrair áudio do vídeo usando FFmpeg"""
    audio_path = video_path.replace(".mp4", ".mp3")

    print(f"[Audio] Extracting audio from {video_path} to {audio_path}")

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

    print(f"[Audio] Audio extracted successfully: {os.path.getsize(audio_path)} bytes")
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

    print(f"[SRT] SRT file generated: {srt_path} ({len(subtitles)} subtitles)")
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

    Para MVP, retorna URL placeholder.
    Descomente o código abaixo para implementar upload real.
    """
    filename = f"{video_id}_rendered.mp4"

    # TODO: Implementar upload para seu storage (S3, R2, etc)
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
    print(f"[Upload] File ready for upload: {file_path}")
    print(f"[Upload] WARNING: Upload não implementado, retornando URL placeholder")
    return f"https://cdn.example.com/videos/{filename}"

def cleanup_files(*file_paths: str):
    """Deletar arquivos temporários"""
    for file_path in file_paths:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                print(f"[Cleanup] Removed: {file_path}")
        except Exception as e:
            print(f"[Cleanup] Error removing {file_path}: {e}")


async def upload_to_r2(file_path: str, r2_key: str) -> str:
    """
    Upload de arquivo para Cloudflare R2.

    Args:
        file_path: Caminho local do arquivo
        r2_key: Chave no R2 (ex: "thumbnails/video123/frame_5.0.jpg")

    Returns:
        URL pública do arquivo
    """
    settings = get_settings()

    # Verificar se R2 está configurado
    if not all([
        settings.r2_account_id,
        settings.r2_access_key_id,
        settings.r2_secret_access_key,
        settings.r2_bucket_name
    ]):
        # Se R2 não está configurado, retorna URL placeholder
        print(f"[R2] WARNING: R2 not configured, returning placeholder URL")
        return f"https://placeholder.r2.dev/{r2_key}"

    try:
        # Configurar cliente S3 para R2
        s3_client = boto3.client(
            's3',
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name='auto'
        )

        # Upload para R2
        with open(file_path, 'rb') as f:
            s3_client.upload_fileobj(
                f,
                settings.r2_bucket_name,
                r2_key,
                ExtraArgs={
                    'ContentType': 'image/jpeg',
                    'CacheControl': 'public, max-age=31536000',  # Cache 1 ano
                }
            )

        # Retornar URL pública
        r2_public_url = settings.r2_public_url or f"https://{settings.r2_bucket_name}.r2.dev"
        public_url = f"{r2_public_url}/{r2_key}"

        print(f"[R2] Uploaded: {file_path} -> {public_url}")
        return public_url

    except ClientError as e:
        print(f"[R2] Upload error: {e}")
        raise Exception(f"Failed to upload to R2: {e}")
