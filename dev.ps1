# ScanVul Dev - chạy cả Frontend + Backend
Write-Host "Starting ScanVul Platform..." -ForegroundColor Cyan

# Backend trong cửa sổ mới
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'Backend (FastAPI)' -ForegroundColor Green; " + `
  "cd '$PSScriptRoot\apps\api'; " + `
  ".\.venv\Scripts\activate; " + `
  "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# Đợi backend khởi động
Start-Sleep -Seconds 2

# Frontend trong terminal hiện tại
Write-Host "Starting Frontend (Next.js)..." -ForegroundColor Green
Set-Location "$PSScriptRoot\apps\web"
npm run dev
