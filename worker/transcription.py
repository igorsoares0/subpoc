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
                language="pt"  # Português
            )

        # 4. Formatar resultado
        # Verificar se segments é lista de dicts ou objetos
        segments = transcription.segments if hasattr(transcription, 'segments') else transcription.get('segments', [])

        print(f"[Transcription] Whisper returned {len(segments)} segments")

        # Acessar como dict ou objeto dependendo do tipo
        subtitles = []
        for i, seg in enumerate(segments, start=1):
            # Tentar acessar como dict primeiro, depois como objeto
            if isinstance(seg, dict):
                subtitles.append({
                    "id": i,
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"].strip()
                })
            else:
                subtitles.append({
                    "id": i,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                })

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

        print(f"[Transcription] ✓ Success! Video {video_id} completed")

    except Exception as e:
        print(f"[Transcription] ✗ Error processing video {video_id}: {e}")

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
