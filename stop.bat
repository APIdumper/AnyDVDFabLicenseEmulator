@echo off
taskkill /f /im node.exe*
setx http_proxy ""
setx https_proxy ""
exit /b 0
