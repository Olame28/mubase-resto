@echo off
REM ============================================================
REM  MUBASE POS - APK Android natif (WebView + fichiers locaux)
REM ============================================================
setlocal enabledelayedexpansion

set SDK=%USERPROFILE%\android-sdk
set JDK=%USERPROFILE%\jdk\extracted\jdk-17.0.21+9
set BT=%SDK%\build-tools\34.0.0
set PLATFORM=%SDK%\platforms\android-34\android.jar
set OUT=build
set SRCDIR=app\src\main

set JAVA_HOME=%JDK%
set PATH=%JDK%\bin;%BT%;%PATH%

if not exist %OUT% mkdir %OUT%
if not exist %OUT%\gen mkdir %OUT%\gen
if not exist %OUT%\classes mkdir %OUT%\classes
if not exist %OUT%\dex mkdir %OUT%\dex

echo [1/6] Compilation des ressources + assets (aapt2)...
%BT%\aapt2.exe compile --dir %SRCDIR%\res -o %OUT%\res.zip
if errorlevel 1 goto :err
%BT%\aapt2.exe link -o %OUT%\app-unsigned.apk -I %PLATFORM% ^
  --manifest %SRCDIR%\AndroidManifest.xml --java %OUT%\gen ^
  -A %SRCDIR%\assets %OUT%\res.zip
if errorlevel 1 goto :err

echo [2/6] Verification assets dans l'APK...
python -c "import zipfile;z=zipfile.ZipFile(r'%OUT%\app-unsigned.apk');n=z.namelist();print('index.html' in str(n), 'js/app.js' in str(n))"

echo [3/6] Compilation Java...
javac -source 8 -target 8 -encoding UTF-8 -cp %PLATFORM% -d %OUT%\classes ^
  %OUT%\gen\com\mubase\pos\R.java ^
  %SRCDIR%\java\com\mubase\pos\MainActivity.java ^
  %SRCDIR%\java\com\mubase\pos\Printer.java
if errorlevel 1 goto :err

echo [4/6] Dex (d8)...
set DEXCLS=
for /r %OUT%\classes %%f in (*.class) do set DEXCLS=!DEXCLS! "%%f"
call %BT%\d8.bat --release --lib %PLATFORM% --output %OUT%\dex %DEXCLS%
if errorlevel 1 goto :err

echo [5/6] Assemblage APK...
copy /y %OUT%\app-unsigned.apk %OUT%\app.apk >nul
pushd %OUT%\dex
%BT%\aapt.exe add ..\app.apk classes.dex >nul
set AAPTERR=%errorlevel%
popd
if not "%AAPTERR%"=="0" goto :err

echo [6/6] Signature APK...
if not exist %OUT%\debug.keystore (
  keytool -genkeypair -v -keystore %OUT%\debug.keystore -alias androiddebugkey ^
    -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android ^
    -dname "CN=Android Debug,O=Android,C=US" >nul 2>&1
)
call %BT%\apksigner.bat sign --ks %OUT%\debug.keystore --ks-pass pass:android ^
  --key-pass pass:android --out %OUT%\MUBASE-POS.apk %OUT%\app.apk
if errorlevel 1 goto :err

echo.
echo ============================================================
echo  APK GENERE : %CD%\%OUT%\MUBASE-POS.apk
echo ============================================================
goto :eof

:err
echo.
echo !!! ERREUR DE COMPILATION - voir messages ci-dessus !!!
exit /b 1
