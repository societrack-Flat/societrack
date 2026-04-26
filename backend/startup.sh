#!/bin/bash
# Azure App Service (Linux) — set "Startup command" in portal to: bash /home/site/wwwroot/startup.sh
# Or: gunicorn -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 app.main:app
set -e
cd /home/site/wwwroot
export PORT="${WEBSITES_PORT:-8000}"
exec gunicorn -w 1 -k uvicorn.workers.UvicornWorker -b "0.0.0.0:${PORT}" app.main:app
