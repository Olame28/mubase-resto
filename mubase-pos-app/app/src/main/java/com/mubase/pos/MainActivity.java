package com.mubase.pos;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * MUBASE POS natif : charge l'application web en local (assets/www)
 * dans un WebView et expose un pont d'impression thermique direct.
 */
public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // IndexedDB / localStorage
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // Android 5.1 : requis pour que la page file:// charge ses
        // sous-ressources (css/js) et fasse des requetes locales
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        // Pont JS -> impression thermique directe
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public boolean printTicket(String text) {
                return Printer.printText(text);
            }
            @JavascriptInterface
            public String printerError() {
                return Printer.lastError;
            }
        }, "MUBASEPrint");

        final boolean[] triedAlt = {false};
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
            @Override public void onReceivedError(WebView view, int errorCode,
                    String description, String failingUrl) {
                // Secours : si le chemin www/ echoue, tenter la racine assets
                if (!triedAlt[0] && failingUrl != null &&
                        failingUrl.indexOf("android_asset/www/") >= 0) {
                    triedAlt[0] = true;
                    view.loadUrl("file:///android_asset/index.html");
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
