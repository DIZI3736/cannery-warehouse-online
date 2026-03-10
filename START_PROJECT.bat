@echo off
chcp 65001 >nul
title [ERP] CANNERY WAREHOUSE - Запуск проекта
setlocal

echo ==========================================
echo    СИСТЕМА УПРАВЛЕНИЯ СКЛАДОМ
echo    ЗАПУСК: БЭКЕНД + ФРОНТЕНД
echo ==========================================
echo.

echo [1/3] Очистка портов (8080, 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /f /pid %%a 2>nul

echo [2/3] Запуск Бэкенда (Spring Boot)...
cd /d "%~dp0backend"
:: Запускаем бэкенд в отдельном окне
start "Cannery Backend" cmd /c "mvnw.cmd spring-boot:run"

echo Ожидание 15 секунд для инициализации сервера и базы данных...
timeout /t 15 /nobreak >nul

echo [3/3] Запуск Фронтенда (Vite)...
cd /d "%~dp0frontend"
:: Запускаем фронтенд в отдельном окне
start "Cannery Frontend" cmd /c "npm run dev"

echo.
echo [УСПЕШНО] Проект запущен!
echo Локальный адрес сайта: http://localhost:5173
echo.

:: Открываем браузер
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

pause
