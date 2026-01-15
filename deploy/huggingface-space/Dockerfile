# ===========================================
# Hugging Face Spaces - Continuum
#
# This Dockerfile pulls from Docker Hub, keeping
# the source code private while allowing public
# access to the running application.
# ===========================================

FROM unmodeledtyler/continuum:latest

# HF Spaces expects port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Override the default port
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
