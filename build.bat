@echo off
FOR /F "tokens=*" %%i IN ('git rev-parse --show-toplevel') DO SET "GIT_ROOT=%%i"
cd /d %GIT_ROOT%
if exist dist rmdir /s /q dist
npx ncc build -m src\index.mjs
type nyanpasu.js dist\index.mjs > dist\nyanpasu.mjs
