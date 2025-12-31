# VANTA Research Chat - Quick Start Guide

## Step 1: Install Dependencies

```bash
cd vanta-chat
npm install
```

## Step 2: Set Up LLaMA Server

### Option A: Use LLaMA Server Already Running

If you have a llama.cpp server running, skip to Step 3.

### Option B: Install and Run LLaMA Server

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Download a model (example: Llama 3.2 3B)
wget https://huggingface.co/QuantFactory/Meta-Llama-3.2-3B-Instruct-GGUF/resolve/main/Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf

# Start the server
./server --model Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --threads 8
```

## Step 3: Configure VANTA Research Chat

### Option A: Use Environment Variable (Recommended)

Create a `.env.local` file:

```env
LLAMA_SERVER_URL=http://localhost:8082
```

### Option B: Use Settings Page

1. Start VANTA Research Chat: `npm run dev`
2. Open http://localhost:3000
3. Click "Settings" button
4. Enter your LLaMA server URL
5. Click "Test Connection" to verify
6. Click "Save"

## Step 4: Start VANTA Research Chat

```bash
# Using the start script
./start-dev.sh

# Or directly with npm
npm run dev
```

## Step 5: Start Chatting!

1. Open http://localhost:3000 in your browser
2. Click "New Chat" or start typing
3. Send a message and enjoy!

## Common Issues

### "Cannot connect to LLaMA server"

**Check:**
- LLaMA server is running: `curl http://localhost:8082/health`
- Server URL is correct in Settings
- Firewall isn't blocking the connection

### "Slow responses"

**Try:**
- Lower "Max Tokens" in Settings
- Use a smaller model (e.g., 3B instead of 7B)
- Increase `--threads` parameter when starting LLaMA server
- Use GPU with `--n-gpu-layers` parameter

### "No response generated"

**Check:**
- Model file is valid (not corrupted)
- Sufficient RAM for the model
- LLaMA server logs for errors

## Recommended Models

### For Testing (Fast)
- Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf (~2GB)
- Phi-3-mini-4k-instruct-Q4_K_M.gguf (~2GB)

### For Production (Balanced)
- Meta-Llama-3.2-7B-Instruct-Q4_K_M.gguf (~4GB)
- Mistral-7B-Instruct-v0.3-Q4_K_M.gguf (~4GB)

### For Best Quality
- Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf (~5GB)

Download models from: https://huggingface.co/models?search=gguf

## Keyboard Shortcuts

- **Enter** - Send message
- **Shift + Enter** - New line in message
- **Escape** - Close sidebar (when open)

## Tips

1. **Start Small**: Use a 3B model for initial testing
2. **Adjust Temperature**: 0.7 for balanced, 1.0+ for creative, 0.3-0.5 for factual
3. **Context Size**: 4096 is good for most use cases
4. **GPU Offloading**: If you have GPU, use `--n-gpu-layers` for speed

## Need Help?

- Check the main README.md for detailed documentation
- Review llama.cpp documentation: https://github.com/ggerganov/llama.cpp
- Ensure your system meets hardware requirements
