# Continuum

Continuum is a desktop AI chat application developed by VANTA Research. It provides a clean, professional interface for interacting with AI models, featuring project organization, document editing with AI collaboration, and a customizable One Dark-inspired theme.

## Features

### Chat Interface
- Real-time streaming chat with AI models
- Multiple chat sessions per project
- Message editing and regeneration
- Copy and delete message actions
- Markdown rendering with syntax highlighting
- File attachments and context sharing

### Project Management
- Organize conversations into projects
- Project-specific file storage
- Session history per project
- Create, rename, and delete projects

### Loom Editor
- Side-by-side document editing with AI assistance
- Real-time AI cursor tracking
- Pending edit review system with accept/reject workflow
- Auto-accept mode for faster collaboration
- Edit and preview modes with live markdown rendering
- File sidebar for project document management

### Model Support
- Local models via llama.cpp server (Atom)
- Mistral API integration
- HuggingFace model downloading
- Configurable temperature and token limits

### Customization
- One Dark theme with customizable accent colors
- Five accent color options: Blue, Green, Purple, Red, Yellow
- Persistent user preferences

### Web Search (Optional)
- Real-time web search integration
- Requires Google Custom Search API configuration

## Technology

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- CodeMirror 6 for editors
- Electron for desktop packaging
- shadcn/ui components

## Requirements

- Node.js 20 or later
- npm
- For local models: llama.cpp server

## Installation

Clone the repository and install dependencies:

```bash
cd continuum
npm install
```

## Configuration

### Environment Variables

Create a `.env.local` file for core settings:

```env
LLAMA_SERVER_URL=http://localhost:8082
```

Create a `.env.search` file for optional web search:

```env
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Settings Page

Access the settings page to configure:

- Model selection (Atom Local, Atom-Large-Experimental, Mistral API)
- LLaMA server URL for local inference
- Temperature and max token parameters
- Response streaming toggle
- Mistral API key
- Accent color preference

## Running the Application

### Development Mode

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Electron Development

```bash
npm run electron:dev
```

### Production Build

```bash
npm run build
npm start
```

### Electron Build

Build for current platform:

```bash
npm run electron:build
```

Build for all platforms:

```bash
npm run electron:build:all
```

## Local Model Setup

### Install llama.cpp

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make
```

### Start the Server

```bash
./server --model your-model.gguf \
  --host 0.0.0.0 \
  --port 8082 \
  --ctx-size 4096 \
  --n-gpu-layers 35
```

## Project Structure

```
continuum/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   ├── chat/          # Chat completion endpoint
│   │   ├── memory/        # Memory/context management
│   │   ├── models/        # Model management endpoints
│   │   ├── projects/      # Project CRUD operations
│   │   ├── search/        # Web search endpoint
│   │   └── settings/      # Settings persistence
│   ├── memory/            # Memory page
│   └── settings/          # Settings page
├── components/
│   ├── canvas/            # Canvas editor components
│   ├── loom/              # Loom editor components
│   ├── projects/          # Project management components
│   └── ui/                # shadcn/ui components
├── lib/                   # Utility functions and types
├── data/                  # Local data storage
└── electron/              # Electron main process
```

## API Endpoints

### Chat

```
POST /api/chat
```

Send messages to the AI model. Supports streaming responses.

### Projects

```
GET    /api/projects              # List all projects
POST   /api/projects              # Create project
GET    /api/projects/[id]         # Get project details
PUT    /api/projects/[id]         # Update project
DELETE /api/projects/[id]         # Delete project
```

### Sessions

```
GET    /api/projects/[id]/sessions           # List sessions
POST   /api/projects/[id]/sessions           # Create session
GET    /api/projects/[id]/sessions/[sid]     # Get session
PUT    /api/projects/[id]/sessions/[sid]     # Update session
DELETE /api/projects/[id]/sessions/[sid]     # Delete session
```

### Files

```
GET    /api/projects/[id]/files              # List files
POST   /api/projects/[id]/files              # Upload file
GET    /api/projects/[id]/files/[fid]        # Get file
PATCH  /api/projects/[id]/files/[fid]        # Update file
DELETE /api/projects/[id]/files/[fid]        # Delete file
```

### Settings

```
GET  /api/settings    # Load settings
POST /api/settings    # Save settings
```

### Models

```
GET  /api/models/available       # List available HuggingFace models
GET  /api/models/local           # List downloaded models
POST /api/models/download        # Download a model
POST /api/models/validate-token  # Validate HuggingFace token
```

## Troubleshooting

### Connection Failed

Verify that the llama.cpp server is running and accessible at the configured URL. Check firewall settings if running on a different machine.

### Slow Responses

Reduce the max tokens setting or use a smaller quantized model. Ensure GPU acceleration is properly configured in llama.cpp.

### Model Not Loading

Confirm the model file path is correct and the file is not corrupted. Check available system memory and VRAM.

## License

MIT License

## Credits

Developed by VANTA Research.

Built with Next.js, React, Tailwind CSS, shadcn/ui, CodeMirror, and Electron.