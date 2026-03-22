import SwiftUI
import WebKit

struct WebViewScreen: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.dataDetectorTypes = []

        // Enable localStorage persistence
        config.websiteDataStore = .default()

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // Allow file:// to make cross-origin requests (for scoreboard API)
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        // Register native storage bridge handlers
        let userContent = config.userContentController
        let storageHandler = NativeStorageHandler()
        let proxy = LeakFreeHandler(storageHandler)
        userContent.add(proxy, name: "nativeStorageSet")
        userContent.add(proxy, name: "nativeStorageRemove")

        // Inject restore + sync script before page loads
        let restoreScript = WKUserScript(source: NativeStorageHandler.bridgeScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        userContent.addUserScript(restoreScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.102, green: 0.102, blue: 0.180, alpha: 1) // #1a1a2e
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Disable zoom
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.maximumZoomScale = 1.0

        // Navigation delegate for external links
        webView.navigationDelegate = context.coordinator

        // Load local index.html from bundle
        if let htmlURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url {
                // Allow local file loading
                if url.isFileURL {
                    decisionHandler(.allow)
                    return
                }
                // Open external URLs in Safari
                if url.scheme == "http" || url.scheme == "https" {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
    }
}

// MARK: - Weak proxy to avoid WKUserContentController retain cycle

class LeakFreeHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?
    init(_ delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(c, didReceive: message)
    }
}

// MARK: - Native Storage Bridge (UserDefaults backup for localStorage)

class NativeStorageHandler: NSObject, WKScriptMessageHandler {

    private static let defaults = UserDefaults.standard
    private static let prefix = "octile_ls_"

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String] else { return }
        let key = body["key"] ?? ""
        switch message.name {
        case "nativeStorageSet":
            Self.defaults.set(body["value"], forKey: Self.prefix + key)
        case "nativeStorageRemove":
            Self.defaults.removeObject(forKey: Self.prefix + key)
        default:
            break
        }
    }

    /// Returns JS that restores UserDefaults → localStorage, then patches setItem/removeItem
    static func bridgeScript() -> String {
        // Build JSON of all backed-up keys from UserDefaults
        let allKeys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(prefix) }
        var entries: [String: String] = [:]
        for fullKey in allKeys {
            let shortKey = String(fullKey.dropFirst(prefix.count))
            if let val = defaults.string(forKey: fullKey) {
                entries[shortKey] = val
            }
        }
        let jsonData = (try? JSONSerialization.data(withJSONObject: entries)) ?? Data()
        let jsonStr = String(data: jsonData, encoding: .utf8) ?? "{}"

        return """
        (function(){
          try {
            var backup = \(jsonStr);
            for (var k in backup) {
              if (localStorage.getItem(k) === null) {
                localStorage.setItem(k, backup[k]);
              }
            }
          } catch(e) {}
          var origSet = localStorage.setItem.bind(localStorage);
          var origRemove = localStorage.removeItem.bind(localStorage);
          localStorage.setItem = function(k, v) {
            origSet(k, v);
            try { webkit.messageHandlers.nativeStorageSet.postMessage({key:k, value:String(v)}); } catch(e) {}
          };
          localStorage.removeItem = function(k) {
            origRemove(k);
            try { webkit.messageHandlers.nativeStorageRemove.postMessage({key:k}); } catch(e) {}
          };
        })();
        """
    }
}
