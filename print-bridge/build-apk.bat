@echo off
REM ============================================================
REM  MUBASE Print - Compilation APK (Windows)
REM ============================================================
setlocal

set SDK=%USERPROFILE%\android-sdk
set JDK=%USERPROFILE%\jdk\extracted\jdk-17.0.21+9
set BT=%SDK%\build-tools\34.0.0
set PLATFORM=%SDK%\platforms\android-34\android.jar
set OUT=build

set JAVA_HOME=%JDK%
set PATH=%JDK%\bin;%BT%;%PATH%

if not exist %OUT% mkdir %OUT%
if not exist %OUT%\gen mkdir %OUT%\gen
if not exist %OUT%\classes mkdir %OUT%\classes
if not exist %OUT%\dex mkdir %OUT%\dex

echo [1/6] Compilation des ressources (aapt2)...
%BT%\aapt2.exe compile --dir app\src\main\res -o %OUT%\res.zip
if errorlevel 1 goto :err

echo [2/6] Lien de l'APK non signee...
%BT%\aapt2.exe link -o %OUT%\app-unsigned.apk -I %PLATFORM% ^
  --manifest app\src\main\AndroidManifest.xml --java %OUT%\gen %OUT%\res.zip
if errorlevel 1 goto :err

echo [3/6] Compilation Java...
javac -source 8 -target 8 -encoding UTF-8 -cp %PLATFORM% -d %OUT%\classes ^
  %OUT%\gen\com\mubase\print\R.java ^
  app\src\main\java\com\mubase\print\MainActivity.java
if errorlevel 1 goto :err

echo [4/6] Dex (d8)...
call %BT%\d8.bat --release --lib %PLATFORM% --output %OUT%\dex ^
  %OUT%\classes\com\mubase\print\MainActivity.class ^
  %OUT%\classes\com\mubase\print\MainActivity$1.class ^
  %OUT%\classes\com\mubase\print\MainActivity$2.class ^
  %OUT%\classes\com\mubase\print\MainActivity$3.class ^
  %OUT%\classes\com\mubase\print\MainActivity$4.class ^
  %OUT%\classes\com\mubase\print\R.class
if errorlevel 1 goto :err

echo [5/6] Assemblage APK...
copy /y %OUT%\app-unsigned.apk %OUT%\app.apk >nul
%BT%\aapt.exe add %OUT%\app.apk %OUT%\dex\classes.dex >nul
if errorlevel 1 goto :err

echo [6/6] Signature APK...
if not exist %OUT%\debug.keystore (
  keytool -genkeypair -v -keystore %OUT%\debug.keystore -alias androiddebugkey ^
    -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android ^
    -dname "CN=Android Debug,O=Android,C=US" >nul 2>&1
)
call %BT%\apksigner.bat sign --ks %OUT%\debug.keystore --ks-pass pass:android ^
  --key-pass pass:android --out %OUT%\MUBASE-Print.apk %OUT%\app.apk
if errorlevel 1 goto :err

echo.
echo ============================================================
echo  APK GENERE : %CD%\%OUT%\MUBASE-Print.apk
echo ============================================================
goto :eof

:err
echo.
echo !!! ERREUR DE COMPILATION - voir messages ci-dessus !!!
exit /b 1
