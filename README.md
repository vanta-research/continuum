<p align="center">
  <img src="docs/continuum-logo.png" alt="Continuum" width="140" />
</p>

<h1 align="center">Continuum</h1>

<p align="center">
  <strong>A collaborative workspace designed for human-AI thinking.</strong>
</p>

<p align="center">
  Real-time co-editing with AI • Multi-provider support • Run models locally • Full privacy control
</p>

<p align="center">
  <a href="#get-started">Get Started</a> •
  <a href="#the-loom">The Loom</a> •
  <a href="#why-continuum">Why Continuum</a> •
  <a href="#privacy-first">Privacy</a>
</p>

---

## What Is Continuum?

Continuum is a desktop workspace where you and AI write, research, and think together in real-time. 

**Think Notion meets Claude, but actually built for collaboration from scratch.**

- **The Loom** — A real-time collaborative editor where you see AI typing alongside you, with full diff control over every change
- **Project Spaces** — Separate contexts for different work (research, writing, development) with persistent conversation history
- **True Multi-Provider** — OpenAI, Anthropic, Mistral, OpenRouter, or run models locally via llama.cpp
- **Privacy-First** — Run completely offline with local models, or use cloud APIs. Your choice, always.

**Use it for:**
- Technical writing and documentation
- Research and synthesis
- Creative writing and ideation
- Code planning and architecture discussions
- Personal knowledge management

---

## Why Continuum?

### Real-Time Collaboration, Not Turn-Taking

Watch the AI's cursor move. See thoughts form character by character. Accept, reject, or edit suggestions as they appear. This isn't chat with copy-paste—it's actual co-authoring.

Every AI edit shows as a pending diff. You stay in control without breaking flow.

### Separate Spaces for Different Thinking

Your novel doesn't belong in the same context as your startup research. Continuum gives you distinct project spaces, each with:
- Its own conversation threads
- Dedicated file references
- Persistent context across sessions
- Independent settings and tone

Switch projects and the workspace adapts. Clean mental boundaries.

### Use Any Model—Cloud or Local

**Cloud APIs:**
- OpenAI (GPT-4o, GPT-4, o1)
- Anthropic (Claude 3.5 Sonnet, Opus, Haiku)
- Mistral (Large, Medium, Small)
- OpenRouter (300+ models)
- Custom OpenAI-compatible endpoints

**Local Models:**
- Run llama.cpp for complete offline operation
- Works with any GGUF model (Llama, Mistral, Qwen, etc.)
- Download models directly from HuggingFace through the UI
- Zero telemetry, zero data leaving your machine

Configure once, switch between providers instantly. The architecture is model-agnostic.

---

## The Loom

The Loom is Continuum's real-time collaborative editor. This is where you work *with* AI, not just prompt it.

**How it works:**
1. You and the AI share a cursor in the same document
2. AI edits stream in character-by-character (watch it type)
3. Every change appears as a reviewable diff
4. Accept, reject, or manually edit any suggestion
5. Enable auto-accept for full creative flow mode

**Features:**
- **Native Markdown** with live preview
- **Drag-and-drop** file imports (images, docs, references)
- **Export to PDF** with configurable formatting (headers, footers, page numbers)
- **Version history** via persistent storage
- **Multiple documents** per project
- **File manager** with folders — Organize documents hierarchically, create new documents directly in folders via right-click
- **Document tagging** — Use `@` in chat to tag any document as context, auto-opens in Loom for seamless editing

This isn't a document editor with AI bolted on. It's a shared workspace where both participants can write.

---

## Conversation + Context

Chat isn't just for commands—it's for thinking out loud.

- Explore ideas before committing to the Loom
- Ask questions about your documents
- Branch into multiple conversation threads
- Resume any past discussion with full context
- **Tag documents with `@`** — Reference any file from your project as context for the conversation

Every project maintains its own conversation history. Switch projects, switch contexts. Your thinking stays organized.

---

## Privacy First

Your drafts, ideas, and thinking shouldn't live on someone else's servers by default.

**Continuum gives you control:**

- **Run completely offline** with llama.cpp (zero data leaves your machine)
- **Or use cloud APIs** when you need more capability
- **Zero telemetry** — No tracking, no phone-home, no analytics
- **Local-first storage** — All data stored as plain files on your disk

**For local AI:**
1. Install llama.cpp
2. Download any GGUF model (built-in HuggingFace browser in settings)
3. Point Continuum at your local server
4. Work offline with complete privacy

**For cloud APIs:**
- API keys stored locally, encrypted
- Configurable per-project
- Switch providers anytime

The architecture is built to support both. You decide where your data goes.

---

## Get Started

### Quick Start (Web)

```bash
git clone https://github.com/vanta-research/continuum.git
cd continuum
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

### Desktop App

```bash
npm run electron:dev
```

The desktop app is a native Electron application (not a browser tab). Ships with **One Dark** theme and five accent colors (Blue, Green, Purple, Red, Yellow).

### Setting Up Local AI (Optional)

For complete offline operation:

**1. Install llama.cpp**
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make
```

**2. Run a model server**
```bash
./llama-server --model path/to/model.gguf --port 8082 --ctx-size 4096
```

Recommended starter model: [Atom-Olmo3-7B](https://huggingface.co/mradermacher/atom-olmo3-7b-GGUF)

**3. Configure Continuum**
- Settings → API Keys → Add llama.cpp endpoint
- Or set `LLAMA_SERVER_URL=http://localhost:8082` in `.env.local`

You can also download models directly through Continuum's UI (Settings → Download Models).

---

## Configuration

### Environment Variables

Optional `.env.local`:
```env
LLAMA_SERVER_URL=http://localhost:8082
```

### In-App Settings

Access via Settings menu:

- **API Keys** — Configure OpenAI, Anthropic, Mistral, OpenRouter (stored locally, encrypted)
- **Model Selection** — Choose which models appear in your dropdown across all providers
- **Download Models** — Browse and download GGUF models from HuggingFace
- **General** — Temperature, max tokens, accent color
- **Project Settings** — Per-project model and provider configuration

---

## Building

### Web
```bash
npm run build && npm start
```

### Desktop
```bash
npm run electron:build        # Current platform
npm run electron:build:all    # All platforms
```

---

## Under the Hood

<details>
<summary><strong>Tech Stack</strong></summary>

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- CodeMirror 6
- Electron
- shadcn/ui

</details>

<details>
<summary><strong>Architecture</strong></summary>

```
continuum/
├── app/                    # Pages and API routes
│   ├── api/
│   │   ├── chat/          # AI completions (streaming)
│   │   ├── projects/      # Workspace management
│   │   ├── models/        # Model management
│   │   └── settings/      # Preferences
│   └── ...
├── components/
│   ├── loom/              # The Loom editor
│   ├── projects/          # Workspace UI
│   └── ui/                # Shared components
├── lib/                   # Core utilities
└── electron/              # Desktop wrapper
```

</details>

<details>
<summary><strong>API Reference</strong></summary>

**Chat**
```
POST /api/chat                              # Streaming AI completion
```

**Projects (Workspaces)**
```
GET|POST        /api/projects               # List / Create
GET|PUT|DELETE  /api/projects/[id]          # Read / Update / Delete
```

**Sessions (Threads)**
```
GET|POST        /api/projects/[id]/sessions
PUT|DELETE      /api/projects/[id]/sessions/[sid]
```

**Files**
```
GET|POST        /api/projects/[id]/files
PATCH|DELETE    /api/projects/[id]/files/[fid]
```

**Models**
```
GET   /api/models/available                 # Browse HuggingFace
GET   /api/models/local                     # List downloaded
POST  /api/models/download                  # Download model
GET   /api/models/openai                    # List OpenAI models
GET   /api/models/anthropic                 # List Anthropic models
GET   /api/models/mistral                   # List Mistral models
GET   /api/models/openrouter                # List OpenRouter models
```

</details>

---

## Requirements

- Node.js 20+
- npm
- For local AI: llama.cpp + GPU (recommended)

---

## Roadmap

**Shipped:**
- [x] Real-time collaborative editing (The Loom)
- [x] Multi-provider support (OpenAI, Anthropic, Mistral, OpenRouter)
- [x] Local model support (llama.cpp + Ollama integration)
- [x] PDF export with formatting options
- [x] Model selection and download UI
- [x] File manager with folder organization
- [x] Document tagging (`@mentions`) for adding context to conversations

**In Development:**
- [ ] Voice input/output
- [ ] Plugin system for extensibility
- [ ] Collaborative multiplayer spaces
- [ ] Mobile apps (iOS/Android)
- [ ] Web clipper for research
- [ ] Enhanced RAG for long documents

---

## Contributing

Built by [VANTA Research](https://github.com/vanta-research).

Contributions welcome. Fork, branch, PR.

**Development:**
- Report bugs via [Issues](https://github.com/vanta-research/continuum/issues)
- Discuss features in [Discussions](https://github.com/vanta-research/continuum/discussions)
- See architecture details in the [Tech Stack](#under-the-hood) section

---

## License

MIT License — Use it, modify it, ship it.

---

<p align="center">
  <strong>Continuum is a space for thinking with AI, not just prompting it.</strong>
</p>

<p align="center">
  <a href="https://github.com/vanta-research/continuum">GitHub</a> •
  <a href="https://github.com/vanta-research/continuum/issues">Issues</a> •
  <a href="https://github.com/vanta-research/continuum/discussions">Discussions</a>
</p>
