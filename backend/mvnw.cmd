@echo off
set "MAVEN_OPTS=-Dmaven.multiModuleProjectDirectory="%CD%""
if not exist ".mvn\wrapper\maven-wrapper.jar" (
    echo [INFO] Skachivayu Maven Wrapper...
    powershell -Command "New-Item -ItemType Directory -Force -Path '.mvn\wrapper'; (New-Object System.Net.WebClient).DownloadFile('https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar', '.mvn\wrapper\maven-wrapper.jar')"
)
echo [INFO] Zapusk Backend...
java %MAVEN_OPTS% -cp ".mvn\wrapper\maven-wrapper.jar" org.apache.maven.wrapper.MavenWrapperMain spring-boot:run
