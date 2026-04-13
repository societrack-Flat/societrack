#!/bin/bash

echo "🚀 Starting Societrack Backend..."

# Check if virtual environment exists
if [ ! -d "backend/.venv" ]; then
    echo "Creating virtual environment..."
    cd backend
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    echo "Virtual environment exists"
    cd backend
    source .venv/bin/activate
    cd ..
fi

# Start the backend
echo "Starting FastAPI server..."
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
