import SwiftUI

@main
struct OctileApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewScreen()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
    }
}
