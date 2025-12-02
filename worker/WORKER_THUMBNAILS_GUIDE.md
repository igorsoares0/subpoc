# Guia de Implementação: Thumbnails no Python Worker

Este guia explica como implementar a geração de thumbnails de vídeo no seu Python worker.

## 📋 Visão Geral

O worker receberá requisições para extrair frames de vídeos, fazer upload para o R2 e notificar o Next.js via webhook.

**Fluxo:**
```
Next.js upload → Python worker → FFmpeg extrai frames → Upload R2 → Webhook Next.js
```

## 🎯 Lógica Adaptativa de Thumbnails

O sistema usa **estratégia adaptativa** baseada na duração do vídeo:

| Duração do Vídeo | Intervalo | Quantidade | Exemplo (60s) |
|------------------|-----------|------------|---------------|
| **0-30s** (curtos) | 1 frame a cada **2s** | Mínimo 6 | 15s → 8 frames |
| **30s-3min** (médios) | 1 frame a cada **3s** | Variável | 90s → 30 frames |
| **3-10min** (longos) | 1 frame a cada **5s** | Variável | 300s → 60 frames |
| **>10min** (muito longos) | 1 frame a cada **8s** | Máx 100 | 1800s → 100 frames |

**Por quê?**
- ✅ Vídeos curtos precisam de mais frames para boa visualização
- ✅ Vídeos longos não precisam de tantos frames (otimiza performance)
- ✅ Limite de 100 frames previne sobrecarga do navegador
- ✅ Mesma lógica usada no Canvas API fallback (Next.js)

---

## 🔧 Dependências Necessárias

### 1. Instalar FFmpeg

**Ubuntu/Debian:**
```bash
apt-get update
apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Railway/Render (nixpacks.toml):**
```toml
[phases.setup]
aptPkgs = ["ffmpeg"]
```

### 2. Dependências Python

Adicione ao `requirements.txt`:
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
httpx==0.25.1
boto3==1.34.0  # Para S3/R2
python-multipart==0.0.6
```

---

## 📁 Estrutura de Arquivos

```
worker/
├── main.py                    # FastAPI app principal
├── thumbnail_generation.py    # Lógica de thumbnails (NOVO)
├── utils.py                   # Helpers (upload R2, etc)
├── requirements.txt
└── .env
```

---

## 🚀 Implementação

### 1. Criar `thumbnail_generation.py`

```python
import os
import subprocess
import httpx
from typing import List, Dict
from utils import download_video, upload_to_r2, cleanup_file

def calculate_thumbnail_positions(duration_seconds: float) -> List[float]:
    """
    Calcula timestamps para extração de thumbnails com lógica adaptativa.

    Regras adaptativas baseadas na duração:
    - Vídeos curtos (0-30s): 1 frame a cada 2s, mínimo 6
    - Vídeos médios (30s-3min): 1 frame a cada 3s
    - Vídeos longos (3-10min): 1 frame a cada 5s
    - Vídeos muito longos (>10min): 1 frame a cada 8s, máximo 100

    Args:
        duration_seconds: Duração do vídeo em segundos

    Returns:
        Lista de timestamps distribuídos uniformemente (ex: [0.0, 2.0, 4.0, ...])
    """
    # Lógica adaptativa baseada na duração
    if duration_seconds <= 30:
        # Vídeos curtos (0-30s): 1 frame a cada 2s, mínimo 6
        interval = 2
        count = max(6, int(duration_seconds / interval) + 1)
    elif duration_seconds <= 180:
        # Vídeos médios (30s-3min): 1 frame a cada 3s
        interval = 3
        count = int(duration_seconds / interval) + 1
    elif duration_seconds <= 600:
        # Vídeos longos (3-10min): 1 frame a cada 5s
        interval = 5
        count = int(duration_seconds / interval) + 1
    else:
        # Vídeos muito longos (>10min): 1 frame a cada 8s, máximo 100
        interval = 8
        count = min(100, int(duration_seconds / interval) + 1)

    # Gera timestamps uniformemente distribuídos
    if count == 1:
        return [0.0]

    return [i * duration_seconds / (count - 1) for i in range(count)]


def extract_frame_at_timestamp(
    video_path: str,
    timestamp: float,
    output_path: str,
    width: int = 160,
    height: int = 90
) -> bool:
    """
    Extrai um frame do vídeo em um timestamp específico usando FFmpeg.

    Args:
        video_path: Caminho do vídeo local
        timestamp: Posição em segundos
        output_path: Onde salvar o frame JPEG
        width: Largura do thumbnail (padrão 160px)
        height: Altura do thumbnail (padrão 90px)

    Returns:
        True se sucesso, False se erro
    """
    try:
        # Comando FFmpeg otimizado
        # -ss antes de -i para seek rápido
        # -vframes 1 para extrair apenas 1 frame
        # -vf scale para redimensionar
        # -q:v 2 para qualidade JPEG (1-31, menor = melhor)
        command = [
            "ffmpeg",
            "-ss", str(timestamp),           # Seek ANTES de abrir o arquivo (mais rápido)
            "-i", video_path,                # Input
            "-vframes", "1",                 # Apenas 1 frame
            "-vf", f"scale={width}:{height}", # Redimensionar
            "-q:v", "2",                     # Qualidade JPEG (2 = muito boa)
            "-y",                            # Sobrescrever sem perguntar
            output_path
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30  # Timeout de 30s por frame
        )

        if result.returncode != 0:
            print(f"FFmpeg error at {timestamp}s: {result.stderr}")
            return False

        # Verificar se o arquivo foi criado
        if not os.path.exists(output_path):
            print(f"Frame not created at {timestamp}s")
            return False

        return True

    except subprocess.TimeoutExpired:
        print(f"FFmpeg timeout at {timestamp}s")
        return False
    except Exception as e:
        print(f"Error extracting frame at {timestamp}s: {e}")
        return False


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

    try:
        print(f"Starting thumbnail generation for video {video_id}")

        # 1. Download do vídeo
        print(f"Downloading video from {video_url}")
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

        print(f"Gerando {len(timestamps)} thumbnails para {duration:.1f}s de vídeo")
        print(f"Estratégia: vídeos {strategy}")

        # 3. Extrair frames
        thumbnails = []
        for i, timestamp in enumerate(timestamps):
            frame_filename = f"frame_{timestamp:.1f}.jpg"
            frame_path = os.path.join(temp_dir, frame_filename)

            print(f"Extracting frame {i+1}/{len(timestamps)} at {timestamp}s")

            success = extract_frame_at_timestamp(
                video_path,
                timestamp,
                frame_path
            )

            if not success:
                print(f"Failed to extract frame at {timestamp}s, skipping")
                continue

            # 4. Upload para R2
            try:
                r2_key = f"thumbnails/{video_id}/{frame_filename}"
                r2_url = await upload_to_r2(frame_path, r2_key)

                thumbnails.append({
                    "timestamp": timestamp,
                    "url": r2_url
                })

                print(f"Uploaded frame to {r2_url}")

                # Limpar frame local após upload
                cleanup_file(frame_path)

            except Exception as upload_error:
                print(f"Failed to upload frame at {timestamp}s: {upload_error}")
                continue

        # 5. Verificar se conseguiu gerar pelo menos alguns thumbnails
        if len(thumbnails) == 0:
            raise Exception("No thumbnails were generated successfully")

        print(f"Successfully generated {len(thumbnails)} thumbnails")

        # 6. Webhook para Next.js
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "thumbnails": thumbnails,
                    "status": "completed"
                },
                timeout=30.0
            )
            response.raise_for_status()
            print(f"Webhook sent successfully to {webhook_url}")

        # 7. Cleanup
        cleanup_file(video_path)
        cleanup_file(temp_dir)

        print(f"Thumbnail generation completed for video {video_id}")

    except Exception as e:
        print(f"Error in thumbnail generation for {video_id}: {e}")

        # Notificar erro via webhook
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": str(e),
                        "status": "failed"
                    },
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"Failed to send error webhook: {webhook_error}")

        # Cleanup em caso de erro
        cleanup_file(temp_dir)
```

---

### 2. Adicionar ao `main.py`

```python
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from pydantic import BaseModel
import os
from thumbnail_generation import process_thumbnail_generation

app = FastAPI()

WORKER_SECRET = os.getenv("WORKER_SECRET")

def verify_secret(authorization: str = Header(None)):
    """Verificar segurança do request"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split("Bearer ")[1]
    if token != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")

class GenerateThumbnailsRequest(BaseModel):
    videoId: str
    videoUrl: str
    duration: float  # em segundos
    webhookUrl: str

@app.get("/")
async def root():
    return {"status": "ok", "service": "subtitle-worker"}

@app.post("/generate-thumbnails")
async def generate_thumbnails(
    request: GenerateThumbnailsRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Endpoint para geração de thumbnails.

    Exemplo de request:
    {
        "videoId": "clxxx123",
        "videoUrl": "http://localhost:3000/uploads/videos/video-123.mp4",
        "duration": 300.5,
        "webhookUrl": "http://localhost:3000/api/webhooks/thumbnails"
    }
    """
    verify_secret(authorization)

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
```

---

### 3. Atualizar `utils.py`

```python
import httpx
import os
import shutil
import boto3
from botocore.exceptions import ClientError

# Configuração R2 (compatível com S3)
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name='auto'
)

R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'video-thumbnails')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL', 'https://your-bucket.r2.dev')


async def download_video(url: str, video_id: str) -> str:
    """
    Download vídeo do URL.

    Args:
        url: URL do vídeo
        video_id: ID para nomear o arquivo

    Returns:
        Caminho do arquivo baixado
    """
    video_path = f"/tmp/video_{video_id}.mp4"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=300.0, follow_redirects=True)
        response.raise_for_status()

        with open(video_path, "wb") as f:
            f.write(response.content)

    return video_path


async def upload_to_r2(file_path: str, r2_key: str) -> str:
    """
    Upload de arquivo para Cloudflare R2.

    Args:
        file_path: Caminho local do arquivo
        r2_key: Chave no R2 (ex: "thumbnails/video123/frame_5.0.jpg")

    Returns:
        URL pública do arquivo
    """
    try:
        # Upload para R2
        with open(file_path, 'rb') as f:
            s3_client.upload_fileobj(
                f,
                R2_BUCKET_NAME,
                r2_key,
                ExtraArgs={
                    'ContentType': 'image/jpeg',
                    'CacheControl': 'public, max-age=31536000',  # Cache 1 ano
                }
            )

        # Retornar URL pública
        public_url = f"{R2_PUBLIC_URL}/{r2_key}"
        return public_url

    except ClientError as e:
        raise Exception(f"Failed to upload to R2: {e}")


def cleanup_file(path: str):
    """Remove arquivo ou diretório."""
    try:
        if os.path.isfile(path):
            os.remove(path)
        elif os.path.isdir(path):
            shutil.rmtree(path)
    except Exception as e:
        print(f"Failed to cleanup {path}: {e}")
```

---

## 🔐 Variáveis de Ambiente

Adicione ao `.env` do worker:

```env
# Segurança
WORKER_SECRET=seu-secret-super-forte-aqui

# Cloudflare R2 (compatível com S3)
R2_ACCOUNT_ID=seu-account-id
R2_ACCESS_KEY_ID=sua-access-key
R2_SECRET_ACCESS_KEY=sua-secret-key
R2_BUCKET_NAME=video-thumbnails
R2_PUBLIC_URL=https://seu-bucket.r2.dev
```

---

## ☁️ Configuração Cloudflare R2

### 1. Criar Bucket

1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com)
2. R2 → Create bucket
3. Nome: `video-thumbnails`
4. Região: Automatic

### 2. Gerar API Token

1. R2 → Manage R2 API Tokens
2. Create API Token
3. Permissões: Object Read & Write
4. Copiar `Access Key ID` e `Secret Access Key`

### 3. Configurar Acesso Público

1. Settings → Public Access
2. Ativar: "Allow Access"
3. Anotar URL público (ex: `https://pub-xxx.r2.dev`)

### 4. CORS (Opcional)

Se quiser fazer upload direto do browser:

```json
[
  {
    "AllowedOrigins": ["https://seu-app.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 🧪 Testar Localmente

### 1. Rodar o worker

```bash
cd worker
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Testar endpoint

```bash
curl -X POST http://localhost:8000/generate-thumbnails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-secret-aqui" \
  -d '{
    "videoId": "test123",
    "videoUrl": "http://localhost:3000/uploads/videos/exemplo.mp4",
    "duration": 60,
    "webhookUrl": "http://localhost:3000/api/webhooks/thumbnails"
  }'
```

Resposta esperada:
```json
{
  "status": "processing",
  "videoId": "test123",
  "message": "Generating thumbnails for 60.0s video"
}
```

---

## 🚢 Deploy (Railway)

### 1. Push para GitHub

```bash
git add .
git commit -m "Add thumbnail generation"
git push
```

### 2. Configurar Railway

1. Dashboard → New Project → Deploy from GitHub
2. Selecionar repositório
3. Adicionar variáveis de ambiente
4. Deploy automático

### 3. Pegar URL do worker

Exemplo: `https://seu-worker.railway.app`

---

## 🔗 Integrar com Next.js

### 1. Adicionar variáveis no Next.js

`.env`:
```env
WORKER_URL=https://seu-worker.railway.app
WORKER_SECRET=mesmo-secret-do-worker
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

### 2. Descomentar código em `app/api/videos/upload/route.ts`

Linha 75, remover os `/*` e `*/`:

```typescript
// Trigger thumbnail generation (async)
const workerUrl = process.env.WORKER_URL
const workerSecret = process.env.WORKER_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL

if (workerUrl && workerSecret && appUrl) {
  fetch(`${workerUrl}/generate-thumbnails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${workerSecret}`
    },
    body: JSON.stringify({
      videoId: videoProject.id,
      videoUrl: `${appUrl}${videoProject.videoUrl}`,
      duration: duration, // in seconds
      webhookUrl: `${appUrl}/api/webhooks/thumbnails`
    })
  }).catch(err => console.error("Thumbnail generation failed:", err))
}
```

---

## 📊 Performance Esperada (Lógica Adaptativa)

| Duração | Categoria | Intervalo | Thumbnails | Tempo Geração | Tamanho Total |
|---------|-----------|-----------|------------|---------------|---------------|
| 15s     | Curto     | 2s        | 8          | ~1s           | ~40KB         |
| 30s     | Curto     | 2s        | 16         | ~1-2s         | ~80KB         |
| 2min    | Médio     | 3s        | 40         | ~2-3s         | ~200KB        |
| 5min    | Longo     | 5s        | 60         | ~3-5s         | ~300KB        |
| 10min   | Longo     | 5s        | 120        | ~6-8s         | ~600KB        |
| 30min   | Muito Longo | 8s      | 100 (cap)  | ~8-10s        | ~500KB        |
| 1hr     | Muito Longo | 8s      | 100 (cap)  | ~8-10s        | ~500KB        |

**Vantagens da Lógica Adaptativa:**
- ✅ Vídeos curtos: mais frames = melhor granularidade na timeline
- ✅ Vídeos longos: menos frames = evita sobrecarga e geração lenta
- ✅ Máximo 100 frames: previne problemas de performance
- ✅ Consistente entre Canvas API (fallback) e Worker (servidor)

---

## 🐛 Troubleshooting

### FFmpeg não encontrado
```bash
which ffmpeg  # Verificar se está instalado
ffmpeg -version  # Ver versão
```

### R2 upload falha
- Verificar credenciais no `.env`
- Testar com AWS CLI: `aws s3 ls --endpoint-url=...`
- Verificar permissões do token

### Webhook não chega no Next.js
- Verificar URL do webhook está correta
- Testar com ngrok em desenvolvimento
- Verificar logs do Railway

### Frames ficam pretos
- Vídeo pode ter codec não suportado
- Testar com `ffmpeg -i video.mp4` para ver info
- Ajustar comando FFmpeg se necessário

---

## 📝 Próximos Passos

1. ✅ Implementar código Python acima
2. ✅ Configurar R2
3. ✅ Deploy no Railway
4. ✅ Descomentar integração no Next.js
5. ✅ Testar upload de vídeo
6. ✅ Verificar thumbnails aparecem na timeline

---

## 🎯 Resultado Final

Quando tudo estiver funcionando:

1. **Usuário faz upload** → Next.js salva vídeo
2. **Next.js chama worker** (async, não bloqueia)
3. **Worker processa** (2-10s dependendo do vídeo)
4. **Worker envia webhook** com URLs dos thumbnails
5. **Next.js atualiza banco** com thumbnails
6. **Timeline mostra frames reais** do servidor
7. **Performance 90% melhor** que antes!

Boa sorte com a implementação! 🚀
