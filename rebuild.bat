@echo off
setlocal enabledelayedexpansion

set MODE=fast
if /I "%~1"=="--full" set MODE=full
if /I "%~1"=="full" set MODE=full
if /I "%~1"=="-f" set MODE=full

if not "%~1"=="" if /I not "%~1"=="--full" if /I not "%~1"=="full" if /I not "%~1"=="-f" (
	echo Unknown option: %~1
	echo Usage: rebuild.bat [--full^| -f ^| full]
	exit /b 1
)

if /I "%MODE%"=="full" (
	echo Rebuilding Proverb Guessing Game ^(clean build^)...
	echo.

	REM Stop and remove all containers, networks, and images
	echo Cleaning up existing containers and images...
	docker-compose down --rmi all --remove-orphans

	REM Remove any dangling images
	docker image prune -f

	REM Build and start fresh
	echo Building everything from scratch...
	docker-compose up --build -d
) else (
	echo Rebuilding Proverb Guessing Game ^(fast rebuild: frontend^)...
	echo.

	REM Build and restart only app services
	echo Building app services...
	docker-compose up --build -d postgres frontend
)

REM Wait a moment for services to start
timeout /t 10 /nobreak > nul

REM Check status
echo.
echo Checking service status...
docker-compose ps

echo.
echo ========================================
if /I "%MODE%"=="full" (
	echo Clean rebuild completed!
) else (
	echo Fast rebuild completed!
)
echo ========================================
echo Frontend:  http://localhost:3000
echo Database:  postgres:5432
echo ========================================
echo.
pause