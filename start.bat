@echo off
@call npm install
setx http_proxy "http://localhost:8000"
setx https_proxy "http://localhost:8000"
start node .
exit /b 0
