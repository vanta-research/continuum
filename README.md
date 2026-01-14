<p align="center">
  <img src="docs/continuum-logo.png" alt="Continuum" width="140" />
</p>

<h1 align="center">Continuum</h1>

<p align="center">
  <strong>The AI-native cognitive workspace.</strong>
</p>

<p align="center">
  Not a chat app. Not an editor. A space where thinking happens—<br/>
  with artificial intelligence woven into every layer.
</p>

<p align="center">
  <a href="#the-idea">The Idea</a> •
  <a href="#the-loom">The Loom</a> •
  <a href="#enter-your-workspace">Get Started</a> •
  <a href="#own-your-mind">Privacy</a>
</p>

---

## The Idea

We don't need more AI tools. We need better *spaces* for thinking.

A cognitive workspace is where intellectual work happens. It's your writer's study, your research lab, your whiteboard at 2am. It's where ideas emerge, collide, and evolve.

**Continuum is that space—built from the ground up for human-AI collaboration.**

Most AI products treat intelligence as a feature. A button you click. A sidebar that appears. Continuum treats AI as *environment*. It's not something you use; it's something you think *within*.

---

## What Makes It Different

### AI-Native, Not AI-Added

Other tools bolt AI onto existing paradigms. A chat window here. An "improve writing" button there.

Continuum was designed the other way around: **What would a workspace look like if AI was there from the beginning?**

The answer isn't a better chatbot. It's a new kind of space where:
- Your thinking and AI thinking flow together
- Ideas develop through dialogue, not commands
- You stay in control without losing momentum
- Context persists across sessions, projects, and time

### Cognitive Contexts

Your mind doesn't work in one thread. You think about different things in different ways.

Continuum gives you **spaces**—not folders, not tags, but distinct cognitive contexts. Your novel lives in one space. Your startup research in another. Your personal journal in a third.

Each space maintains its own:
- Conversation history
- Reference documents
- AI context and memory
- Tone and working style

Switch between them and feel the shift. Like walking from your studio into your library.

---

## The Loom

<p align="center">
  <em>Where ideas take form.</em>
</p>

The Loom is Continuum's collaborative canvas. It's where you and AI write together—not in turns, but in *flow*.

**Watch ideas emerge.** The AI's cursor moves in real-time. You see thoughts form, not just appear.

**Stay in control.** Every AI suggestion appears as a pending change. Full diffs. Accept what resonates, reject what doesn't. Or flip on auto-accept when you're in creative flow and want the AI to keep up.

**Think in drafts.** The Loom isn't for final copy. It's for exploration. For that messy middle stage where ideas are still finding their shape. Refine later. Think now.

**Native Markdown.** Write in Markdown, preview in real-time. Perfect for technical docs, blog posts, notes, fiction—anything where structure and prose intersect.

The Loom isn't a document editor with AI features. It's a collaboration space that happens to produce documents.

---

## Dialogue, Not Commands

The chat in Continuum isn't a command line. It's a thinking partner.

- **Explore ideas** before committing them to the Loom
- **Ask questions** about your own documents
- **Think out loud** and let the AI reflect back
- **Branch conversations** into new threads when ideas diverge

Every conversation is preserved. Every thread can be resumed. Your thinking accumulates.

---

## Own Your Mind

Here's the thing about cognitive workspaces: they contain your *thinking*. Your half-formed ideas. Your private drafts. Your intellectual fingerprint.

That shouldn't live on someone else's servers.

**Continuum lets you run AI locally.** Your models. Your machine. Your data never leaves.

- **llama.cpp integration** — Run Llama, Mistral, or any GGUF model locally
- **Zero telemetry** — We don't track. We don't phone home. We don't peek.
- **Local storage** — Plain files on your disk. Portable. Yours.

Or connect to cloud APIs when you need more capability. The architecture supports both. The choice is always yours.

**Your mind, your rules.**

---

## The Aesthetic

A workspace should feel like *yours*.

Continuum ships with a carefully crafted **One Dark** theme—easy on the eyes during long sessions, beautiful enough to inspire.

**Five accent colors** let you make it personal: Blue, Green, Purple, Red, Yellow. Small touch. Surprising difference.

**Native desktop app** via Electron. Not a browser tab. Not a web app pretending to be software. A real application that lives in your dock.

Details matter. The space you think in shapes the thoughts you have.

---

## Enter Your Workspace

### Quick Start

```bash
git clone https://github.com/vanta-research/continuum.git
cd continuum
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). You're in.

### Desktop App

```bash
npm run electron:dev
```

### Local AI (Optional)

For complete cognitive sovereignty:

1. **Set up llama.cpp**
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   make
   ```

2. **Download a model** — [Mistral 7B Instruct](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF) is a great start

3. **Run the server**
   ```bash
   ./llama-server --model your-model.gguf --port 8082 --ctx-size 4096
   ```

4. **Configure** — Settings → Model → "Atom Local"

Your AI. Your hardware. Your thoughts.

---

## Configuration

### Environment

Create `.env.local`:
```env
LLAMA_SERVER_URL=http://localhost:8082
```

Optional web search (`.env.search`):
```env
GOOGLE_API_KEY=your_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id
```

### In-App

Everything else lives in Settings:
- Model selection (local or cloud)
- Temperature and token limits  
- Accent color
- API keys (stored locally)

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
```

</details>

---

## Requirements

- Node.js 20+
- npm
- For local AI: llama.cpp + GPU (recommended)

---

## The Future

Continuum is the beginning.

- [ ] **Voice** — Think out loud, literally
- [ ] **Plugins** — Extend the workspace with custom tools
- [ ] **Multiplayer** — Collaborative cognitive spaces
- [ ] **Mobile** — Your workspace, everywhere
- [ ] **More models** — Anthropic, OpenAI, Ollama

The goal isn't to build features. It's to build the best possible space for human-AI thinking.

---

## Contributing

Built by [VANTA Research](https://github.com/vanta-research).

We welcome collaborators who share the vision. Fork, branch, PR.

---

## License

MIT — Use it. Modify it. Make it yours.

---

<p align="center">
  <em>"The tools we use shape the thoughts we think."</em>
</p>

<p align="center">
  <strong>Continuum is the space where your mind meets AI.</strong><br/>
  Not to replace your thinking. To expand it.
</p>

<p align="center">
  <a href="https://github.com/vanta-research/continuum">GitHub</a> •
  <a href="https://github.com/vanta-research/continuum/issues">Issues</a> •
  <a href="https://github.com/vanta-research/continuum/discussions">Discussions</a>
</p>