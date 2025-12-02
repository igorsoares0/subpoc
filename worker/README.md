# Video Subtitle Worker

Microsserviço FastAPI para processamento de vídeos: transcrição e renderização com legendas.

## 🚀 Quick Start

### Pré-requisitos

- Python 3.11+
- FFmpeg instalado
- OpenAI API Key

### Instalação

```bash
# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais
```

### Desenvolvimento Local

```bash
# Rodar servidor
uvicorn main:app --reload

# Ou usando Python diretamente
python main.py
```

Acesse:
- **API:** http://localhost:8000
- **Docs (Swagger):** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

## 📡 Endpoints

### `POST /transcribe`

Transcreve um vídeo usando OpenAI Whisper API.

**Headers:**
```
Authorization: Bearer <WORKER_SECRET>
```

**Body:**
```json
{
  "videoId": "video-123",
  "videoUrl": "https://example.com/video.mp4",
  "webhookUrl": "https://your-app.com/api/webhooks/transcription"
}
```

**Response:**
```json
{
  "status": "processing",
  "videoId": "video-123",
  "message": "Transcription started in background"
}
```

### `POST /render`

Renderiza vídeo com legendas hardcoded usando FFmpeg.

**Headers:**
```
Authorization: Bearer <WORKER_SECRET>
```

**Body:**
```json
{
  "videoId": "video-123",
  "videoUrl": "https://example.com/video.mp4",
  "subtitles": [
    {"id": 1, "start": 0, "end": 3.5, "text": "Hello world"}
  ],
  "style": {
    "fontFamily": "Arial",
    "fontSize": 24,
    "color": "#FFFFFF",
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.8,
    "outlineColor": "#000000",
    "outlineWidth": 2
  },
  "format": "instagram_story",
  "trim": null,
  "overlays": [],
  "webhookUrl": "https://your-app.com/api/webhooks/render-complete"
}
```

**Response:**
```json
{
  "status": "processing",
  "videoId": "video-123",
  "message": "Rendering started in background"
}
```

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `OPENAI_API_KEY` | Chave da API OpenAI | ✅ |
| `WORKER_SECRET` | Token de autenticação | ✅ |
| `ENVIRONMENT` | development/production | ❌ |
| `R2_ACCOUNT_ID` | Cloudflare R2 Account ID | ❌ |
| `R2_ACCESS_KEY_ID` | R2 Access Key | ❌ |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key | ❌ |
| `R2_BUCKET_NAME` | Nome do bucket R2 | ❌ |

## 📁 Estrutura

```
worker/
├── main.py              # FastAPI app principal
├── transcription.py     # Lógica de transcrição
├── rendering.py         # Lógica de renderização
├── utils.py             # Helpers (download, upload, SRT)
├── config.py            # Configurações e variáveis
├── requirements.txt     # Dependências Python
├── .env.example         # Exemplo de variáveis
└── README.md            # Este arquivo
```

## 🌐 Deploy

### Railway

1. Conecte seu repositório no Railway
2. Configure as variáveis de ambiente
3. Railway detecta Python automaticamente

**Importante:** Se FFmpeg não estiver disponível, crie `nixpacks.toml`:

```toml
[phases.setup]
aptPkgs = ["ffmpeg"]
```

### Render

1. New Web Service
2. Conecte repositório
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Configure variáveis de ambiente

## 🧪 Testando

### Com cURL

```bash
# Health check
curl http://localhost:8000/health

# Transcrição
curl -X POST http://localhost:8000/transcribe \
  -H "Authorization: Bearer seu-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "test-123",
    "videoUrl": "https://example.com/video.mp4",
    "webhookUrl": "https://webhook.site/your-unique-url"
  }'
```

### Com Swagger UI

Acesse http://localhost:8000/docs e teste interativamente.

## 📝 Logs

Os logs aparecem no console durante o processamento:

```
[Download] Downloading video from https://...
[Audio] Extracting audio from /tmp/video_123.mp4
[Transcription] Sending to Whisper API...
[Transcription] Whisper returned 42 segments
[Transcription] ✓ Success! Video video-123 completed
```

## ⚠️ Troubleshooting

### FFmpeg não encontrado

**Erro:** `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'`

**Solução:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download de https://ffmpeg.org/download.html
```

### Webhook não está sendo chamado

Verifique se o `webhookUrl` está acessível publicamente.

Para desenvolvimento local, use ngrok:
```bash
ngrok http 3000
# Use a URL do ngrok como webhookUrl
```

### Erro de autenticação

Certifique-se de que `WORKER_SECRET` é o mesmo no Next.js e no Worker.

## 📚 Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

## 📄 Licença

MIT
