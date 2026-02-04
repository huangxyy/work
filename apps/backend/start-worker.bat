@echo off
echo Starting Backend Worker...
cd /d "%~dp0"
npm run start:worker:dev
