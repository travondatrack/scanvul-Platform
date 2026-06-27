Write-Host "Starting ScanVul Platform..." -ForegroundColor Green

# 1. Start Next.js Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title Frontend; cd apps\web; npm run dev"

# 2. Start FastAPI Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title FastAPI Backend; cd apps\api; .\.venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

# 3. Start Celery Worker
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title Celery Worker; cd apps\api; .\.venv\Scripts\activate; celery -A app.worker.celery_app worker --loglevel=info -P solo"

# 4. Start Celery Beat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title Celery Beat; cd apps\api; .\.venv\Scripts\activate; celery -A app.worker.celery_app beat --loglevel=info"

Write-Host "All 4 services started in separate windows! Keep them open while working." -ForegroundColor Cyan
