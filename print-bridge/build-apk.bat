@echo off
REM ============================================================
REM  MUBASE Print - Compilation APK (Windows)
REM  Prerequis : JDK dans %USERPROFILE%\jdk, Android SDK dans
REM  %USERPROFILE%\android-sdk (cmdline-tools + platform + build-tools)
REM ============================================================
setlocal

set SDK=%USERPROFILE%\android-sdk
set JDK=%USERPROFILE%\jdk
set BT=%SDK%\build-tools\34.0.0
set PLATFORM=%SDK%\platforms\android-34\android.jar
set PKG=com.mubase.print
set SRCDIR=app\src\main
set OUT=build

set JAVA_HOME=%JDK%
set ANDROID_HOME=%SDK%
set PATH=%JDK%\bin;%BT%;%PATH%

if not exist %OUT% mkdir %OUT%
if not exist %OUT%\gen mkdir %OUT%\gen
if not exist %OUT%\classes mkdir %OUT%\classes

echo [1/6] Compilation des ressources (aapt2)...
%BT%\aapt2.exe compile --dir %SRCDIR%\res -o %OUT%\res.zip
if errorlevel 1 goto :err

echo [2/6] Lien de l'APK non signee...
%BT%\aapt2.exe link -o %OUT%\app-unsigned.apk -I %PLATFORM% ^
  --manifest %SRCDIR%\AndroidManifest.xml --java %OUT%\gen %OUT%\res.zip
if errorlevel 1 goto :err

echo [3/6] Compilation Java...
javac -source 8 -target 8 -encoding UTF-8 -cp %PLATFORM% -d %OUT%\classes ^
  %OUT%\gen\%PKG:\=\R.java %SRCDIR%\java\%PKG:\=\%\*.java
if errorlevel 1 goto :err

echo [4/6] Dex (d8)...
%d8.bat% --release --lib %PLATFORM% --output %OUT%\dex %OUT%\classes\com\mubase\print\*.class %OUT%\gen\com\mubase\print\R*.class
if errorlevel 1 goto :err

echo [5/6] Assemblage APK...
copy /y %OUT%\app-unsigned.apk %OUT%\app.apk >nul
cd /d %OUT%\dex && %BT%\aapt.exe add %OUT%\app.apk classes.dex >nul 2>&1
cd /d %~dp0
if not exist %OUT%\app.apk goto :err

echo [6/6] Signature APK...
if not exist %OUT%\debug.keystore (
  keytool -genkeypair -v -keystore %OUT%\debug.keystore -alias androiddebugkey ^
    -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android ^
    -dname "CN=Android Debug,O=Android,C=US" >nul 2>&1
)
%BT%\apksigner.bat sign --ks %OUT%\debug.keystore --ks-pass pass:android ^
  --key-pass pass:android --out %OUT%\MUBASE-Print.apk %OUT%\app.apk
if errorlevel 1 goto :err

echo.
echo ============================================================
echo  APK GENERE : %CD%\%OUT%\MUBASE-Print.apk
echo  Transferez ce fichier sur le Citaq et installez-le.
echo ============================================================
goto :eof

:err
echo.
echo !!! ERREUR DE COMPILATION - voir messages ci-dessus !!!
exit /b 1
