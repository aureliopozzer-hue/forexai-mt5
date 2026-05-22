@echo off
echo ============================================
echo ForexAI MT5 Bridge Update Script v2.1.0
echo ============================================
echo.

:: Navigate to the bot directory
cd /d C:\ForexAI\forexai-mt5\mt5-bot

:: Pull latest code from GitHub
echo [1/4] Pulling latest code from GitHub...
git pull origin main
if %errorlevel% neq 0 (
    echo ERROR: Failed to pull from GitHub. Check your internet connection.
    pause
    exit /b 1
)

:: Update Python dependencies
echo [2/4] Updating Python dependencies...
pip install -r requirements.txt --quiet

:: Restart the ForexAIBridge Windows Service
echo [3/4] Restarting ForexAIBridge service...
net stop ForexAIBridge
timeout /t 3 /nobreak > nul
net start ForexAIBridge

:: Wait a moment and check status
echo [4/4] Checking bridge status...
timeout /t 5 /nobreak > nul
curl -s http://localhost:5000/health

echo.
echo ============================================
echo Bridge update complete!
echo The bridge will now automatically sync
echo broker credentials from Supabase.
echo ============================================
pause
