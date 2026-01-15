# ===========================================
# Hugging Face Spaces - Continuum
#
# This Dockerfile pulls from a private container
# registry, keeping the source code private while
# allowing public access to the running application.
#
# SETUP:
# 1. Build and push the main Continuum image to your
#    private registry (GitHub Container Registry, Docker Hub, etc.)
# 2. Create a new HF Space with this Dockerfile
# 3. Add your registry credentials as HF Space secrets:
#    - REGISTRY_USERNAME
#    - REGISTRY_PASSWORD (or token)
# ===========================================

# Option 1: Pull from GitHub Container Registry (recommended)
# FROM ghcr.io/YOUR_ORG/continuum:latest

# Option 2: Pull from Docker Hub
# FROM YOUR_DOCKERHUB_USERNAME/continuum:latest

# For now, using a placeholder - replace with your actual image
FROM ghcr.io/vanta-research/continuum:latest

# HF Spaces expects port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Override the default port
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
