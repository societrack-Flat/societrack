@echo off
echo 🚀 Starting Societrack Backend...

REM Check if virtual environment exists
if not exist "backend\.venv" (
    echo Creating virtual environment...
    cd backend
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
) else (
    echo Virtual environment exists
    cd backend
    call .venv\Scripts\activate
    cd ..
)

REM Start the backend
echo Starting FastAPI server...
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
