import SwiftUI

@main
struct OctileApp: App {
    @StateObject private var deepLink = DeepLinkHandler()

    var body: some Scene {
        WindowGroup {
            WebViewScreen(deepLink: deepLink)
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    deepLink.handle(url)
                }
        }
    }
}

class DeepLinkHandler: ObservableObject {
    @Published var pendingToken: String?
    @Published var pendingName: String?

    func handle(_ url: URL) {
        guard url.scheme == "octile", url.host == "auth" else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        pendingToken = components?.queryItems?.first(where: { $0.name == "token" })?.value
        pendingName = components?.queryItems?.first(where: { $0.name == "name" })?.value
    }
}
