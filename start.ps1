# start.ps1
# Lệnh chạy toàn bộ hệ thống ScanVul AI (Frontend, Backend, Worker) trong môi trường phát triển

Write-Host "Đang khởi động ScanVul AI..." -ForegroundColor Cyan

# 1. Khởi động FastAPI Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\api; .\venv\Scripts\activate; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

# 2. Khởi động Celery Worker
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\api; .\venv\Scripts\activate; celery -A app.worker.celery_app worker --loglevel=info --pool=solo" -WindowStyle Normal

# 3. Khởi động Next.js Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\web; npm run dev" -WindowStyle Normal

Write-Host "Đã mở 3 cửa sổ Terminal để chạy các dịch vụ!" -ForegroundColor Green
Write-Host "- Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "- Backend: http://localhost:8000" -ForegroundColor Yellow
