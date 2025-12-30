# VANTA Research Chat

A clean, professional, dark-mode optimized AI chat interface built with Next.js and shadcn/ui. Designed to connect to llama.cpp server for local AI inference.

## Features

- Clean, minimal interface inspired by Apple design
- Dark mode optimized with glassy, transparent elements
- Real-time chat with AI assistant
- Multiple chat sessions
- Configurable LLaMA server connection
- Model parameter controls (temperature, max tokens, streaming)
- Responsive design

## Tech Stack

- **Next.js 16** - React framework with App Router
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **Lucide Icons** - Clean, modern icons

## Prerequisites

1. **Node.js 20+** and **npm**
2. **llama.cpp server** running and accessible

## Setup LLaMA Server

### Install llama.cpp

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make
```

### Download a Model

```bash
# Example: Download Llama 3.2 3B (4-bit quantized)
wget https://huggingface.co/QuantFactory/Meta-Llama-3.2-3B-Instruct-GGUF/resolve/main/Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf

# Or download from Hugging Face:
# https://huggingface.co/models?search=gguf
```

### Start LLaMA Server

```bash
./server --model Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 35 \
  --batch-size 512 \
  --threads 8
```

### Server Endpoints

The llama.cpp server provides:
- `POST /completion` - Generate completions
- `POST /chat/completions` - OpenAI-compatible chat API
- `GET /health` - Health check

## Installation

1. Clone repository
2. Install dependencies
3. Configure LLaMA server URL
4. Start development server

```bash
# Install dependencies
cd vanta-chat
npm install

# Start development server
npm run dev
```

## Configuration

### Environment Variables

Create a `.env.local` file in root directory:

```env
LLAMA_SERVER_URL=http://localhost:8082
```

### Settings

Access `/settings` page to configure:
- LLaMA server URL
- Temperature (0-2)
- Max tokens (256-8192)
- Stream responses toggle

## Usage

1. Open `http://localhost:3000` in your browser
2. Click "New Chat" to start a conversation
3. Type your message and press Enter
4. View AI's response in real-time

### Features

- **Sidebar**: Chat history and navigation
- **Multiple Sessions**: Keep multiple conversations
- **Settings**: Configure model parameters
- **Glass Effects**: Beautiful blur effects for modern look
- **Responsive**: Works on desktop and mobile

## API Endpoints

### `/api/chat`
Send a message to LLaMA server.

```bash
POST /api/chat
Content-Type: application/json

{
  "message": "Hello!",
  "sessionId": "session-id"
}
```

### `/api/settings`
Save configuration settings.

```bash
POST /api/settings
Content-Type: application/json

{
  "serverUrl": "http://localhost:8082",
  "temperature": 0.7,
  "maxTokens": 2048,
  "streamResponse": true
}
```

### `/api/test-connection`
Test connection to LLaMA server.

```bash
POST /api/test-connection
Content-Type: application/json

{
  "serverUrl": "http://localhost:8082"
}
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Production Deployment

1. Build the application
2. Set environment variables
3. Start the production server

```bash
npm run build
export LLAMA_SERVER_URL=https://your-llama-server.com
npm start
```

## Troubleshooting

### Connection Failed

- Ensure LLaMA server is running
- Check the URL in Settings
- Verify firewall/network settings

### Slow Responses

- Reduce `max_tokens` setting
- Lower context size in LLaMA server
- Use a smaller model or higher quantization

### GPU Not Used

- Install CUDA toolkit for NVIDIA GPUs
- Use Metal (MPS) for Apple Silicon
- Set `--n-gpu-layers` when starting LLaMA server

## Design Philosophy

This interface is designed with:
- **Minimalism**: Only essential features
- **Clarity**: Clear typography and spacing
- **Performance**: Fast, lightweight interactions
- **Accessibility**: Keyboard navigation and screen reader support
- **Dark Mode**: Optimized for comfortable viewing

## License

MIT License - Feel free to use and modify for your projects.

## Credits

- **Next.js** - React framework
- **shadcn/ui** - UI component library
- **llama.cpp** - LLaMA inference backend
- **VANTA Research** - Branding and design direction
