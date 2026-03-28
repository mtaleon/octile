package com.octile.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity {

    private WebView webView;
    private static final String TAG = "Octile";
    private static final String PREFS_NAME = "octile_data";
    private static final String SITE_URL = "https://mtaleon.github.io/octile/";
    private static final int BUNDLED_VERSION_CODE = 12;

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
                injectStatusBarPadding(view);
                injectStorageBridge(view);
                checkForOtaUpdate(prefs);
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load OTA or bundled assets
        String loadUrl = getWebLoadUrl(prefs);
        Log.i(TAG, "Loading: " + loadUrl);
        webView.loadUrl(loadUrl);
    }

    // --- OTA Update System ---

    /** Determine which web root to load: OTA dir or bundled assets */
    private String getWebLoadUrl(SharedPreferences prefs) {
        int otaVersion = prefs.getInt("ota_version", 0);
        File otaIndex = new File(getFilesDir(), "ota/index.html");

        if (otaVersion > BUNDLED_VERSION_CODE && otaIndex.exists()) {
            Log.i(TAG, "OTA v" + otaVersion + " available, loading from ota/");
            return "file://" + new File(getFilesDir(), "ota/index.html").getAbsolutePath();
        }
        return "file:///android_asset/index.html";
    }

    /** Background check for OTA updates */
    private void checkForOtaUpdate(SharedPreferences prefs) {
        new Thread(() -> {
            try {
                int otaVersion = prefs.getInt("ota_version", 0);
                int localMax = Math.max(BUNDLED_VERSION_CODE, otaVersion);

                // Fetch version.json
                URL url = new URL(SITE_URL + "version.json?t=" + System.currentTimeMillis());
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                String body = readStream(conn.getInputStream());
                conn.disconnect();

                JSONObject json = new JSONObject(body);
                int remoteVersion = json.getInt("versionCode");

                if (remoteVersion <= localMax) {
                    Log.d(TAG, "OTA: up to date (local=" + localMax + ", remote=" + remoteVersion + ")");
                    return;
                }

                String bundleUrl = json.optString("bundleUrl", "");
                String expectedHash = json.optString("bundleHash", "");
                if (bundleUrl.isEmpty()) {
                    Log.d(TAG, "OTA: no bundleUrl in version.json");
                    return;
                }

                Log.i(TAG, "OTA: downloading v" + remoteVersion + " from " + bundleUrl);

                // Download zip
                File zipFile = new File(getCacheDir(), "ota-bundle.zip");
                downloadFile(bundleUrl, zipFile);

                // Verify hash
                if (!expectedHash.isEmpty()) {
                    String actualHash = "sha256:" + sha256(zipFile);
                    if (!expectedHash.equals(actualHash)) {
                        Log.e(TAG, "OTA: hash mismatch! expected=" + expectedHash + " actual=" + actualHash);
                        zipFile.delete();
                        return;
                    }
                    Log.d(TAG, "OTA: hash verified");
                }

                // Extract to ota/ dir
                File otaDir = new File(getFilesDir(), "ota");
                deleteDir(otaDir);
                otaDir.mkdirs();
                unzip(zipFile, otaDir);
                zipFile.delete();

                // Verify extraction
                if (!new File(otaDir, "index.html").exists() ||
                    !new File(otaDir, "app.min.js").exists()) {
                    Log.e(TAG, "OTA: extraction verification failed, cleaning up");
                    deleteDir(otaDir);
                    return;
                }

                // Save version
                prefs.edit().putInt("ota_version", remoteVersion).apply();
                Log.i(TAG, "OTA: v" + remoteVersion + " ready, will load on next launch");

                // Notify WebView
                webView.post(() -> webView.evaluateJavascript(
                    "if(window.onOtaUpdateReady)window.onOtaUpdateReady(" + remoteVersion + ")",
                    null
                ));

            } catch (Exception e) {
                Log.w(TAG, "OTA: check failed: " + e.getMessage());
            }
        }).start();
    }

    // --- Utility methods ---

    private void injectStatusBarPadding(WebView view) {
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
    }

    private void injectStorageBridge(WebView view) {
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

    private static String readStream(InputStream is) throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] tmp = new byte[4096];
        int n;
        while ((n = is.read(tmp)) != -1) {
            buf.write(tmp, 0, n);
        }
        is.close();
        return buf.toString("UTF-8");
    }

    private static void downloadFile(String urlStr, File dest) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        InputStream is = new BufferedInputStream(conn.getInputStream());
        FileOutputStream fos = new FileOutputStream(dest);
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) {
            fos.write(buf, 0, n);
        }
        fos.close();
        is.close();
        conn.disconnect();
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        FileInputStream fis = new FileInputStream(file);
        byte[] buf = new byte[8192];
        int n;
        while ((n = fis.read(buf)) != -1) {
            digest.update(buf, 0, n);
        }
        fis.close();
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static void unzip(File zipFile, File destDir) throws Exception {
        ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)));
        ZipEntry entry;
        byte[] buf = new byte[8192];
        while ((entry = zis.getNextEntry()) != null) {
            if (entry.isDirectory()) continue;
            // Flatten: extract to destDir directly (zip -j was used)
            String name = new File(entry.getName()).getName();
            File out = new File(destDir, name);
            // Guard against zip slip
            if (!out.getCanonicalPath().startsWith(destDir.getCanonicalPath())) continue;
            FileOutputStream fos = new FileOutputStream(out);
            int n;
            while ((n = zis.read(buf)) != -1) {
                fos.write(buf, 0, n);
            }
            fos.close();
            zis.closeEntry();
        }
        zis.close();
    }

    private static void deleteDir(File dir) {
        if (dir == null || !dir.exists()) return;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) deleteDir(f);
                else f.delete();
            }
        }
        dir.delete();
    }

    // --- Lifecycle ---

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
