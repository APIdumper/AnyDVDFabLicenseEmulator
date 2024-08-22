@echo off
@call npm install
setx http_proxy "http://localhost:8000"
setx https_proxy "http://localhost:8000"
start node %~dp0"index.js"
exit /b 0
