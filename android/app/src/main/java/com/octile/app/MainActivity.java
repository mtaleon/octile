package com.octile.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity {

    private WebView webView;
    private static final String PREFS_NAME = "octile_data";

    /** JS bridge: exposes native SharedPreferences to the WebView */
    public class OctileStorage {
        private final SharedPreferences prefs;

        OctileStorage(SharedPreferences prefs) {
            this.prefs = prefs;
        }

        @JavascriptInterface
        public void setItem(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }

        @JavascriptInterface
        public String getItem(String key) {
            return prefs.getString(key, null);
        }

        @JavascriptInterface
        public void removeItem(String key) {
            prefs.edit().remove(key).apply();
        }

        /** Return all keys as JSON array */
        @JavascriptInterface
        public String getAllKeys() {
            Set<String> keys = prefs.getAll().keySet();
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (String k : keys) {
                if (!first) sb.append(",");
                sb.append("\"").append(k.replace("\"", "\\\"")).append("\"");
                first = false;
            }
            sb.append("]");
            return sb.toString();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full-screen immersive with dark status/nav bars
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#1a1a2e"));
        window.setNavigationBarColor(Color.parseColor("#1a1a2e"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true);
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);

        // Prevent zoom
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Load local assets
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        webView.setBackgroundColor(Color.parseColor("#1a1a2e"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Register native storage bridge
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        webView.addJavascriptInterface(new OctileStorage(prefs), "NativeStorage");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Open external links in browser
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Inject status bar height as CSS variable for safe area padding
                int statusBarHeight = 0;
                int resId = getResources().getIdentifier("status_bar_height", "dimen", "android");
                if (resId > 0) {
                    statusBarHeight = getResources().getDimensionPixelSize(resId);
                }
                float density = getResources().getDisplayMetrics().density;
                int heightDp = Math.round(statusBarHeight / density);
                view.evaluateJavascript(
                    "document.body.style.paddingTop='" + heightDp + "px';",
                    null
                );

                // Restore data from native storage into localStorage if missing
                view.evaluateJavascript(
                    "(function(){" +
                    "  if(!window.NativeStorage)return;" +
                    "  try{" +
                    "    var keys=JSON.parse(NativeStorage.getAllKeys());" +
                    "    for(var i=0;i<keys.length;i++){" +
                    "      var k=keys[i];" +
                    "      if(localStorage.getItem(k)===null){" +
                    "        var v=NativeStorage.getItem(k);" +
                    "        if(v!==null)localStorage.setItem(k,v);" +
                    "      }" +
                    "    }" +
                    "  }catch(e){}" +
                    "  var origSet=localStorage.setItem.bind(localStorage);" +
                    "  var origRemove=localStorage.removeItem.bind(localStorage);" +
                    "  localStorage.setItem=function(k,v){" +
                    "    origSet(k,v);" +
                    "    try{NativeStorage.setItem(k,String(v));}catch(e){}" +
                    "  };" +
                    "  localStorage.removeItem=function(k){" +
                    "    origRemove(k);" +
                    "    try{NativeStorage.removeItem(k);}catch(e){}" +
                    "  };" +
                    "})();",
                    null
                );
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
