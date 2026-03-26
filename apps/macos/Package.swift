// swift-tools-version: 6.2
// Package manifest for the GodsEye macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Gods Eye",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "GodsEyeIPC", targets: ["GodsEyeIPC"]),
        .library(name: "GodsEyeDiscovery", targets: ["GodsEyeDiscovery"]),
        .executable(name: "Gods Eye", targets: ["Gods Eye"]),
        .executable(name: "godseye-mac", targets: ["GodsEyeMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/GodsEyeKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "GodsEyeIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "GodsEyeDiscovery",
            dependencies: [
                .product(name: "GodsEyeKit", package: "GodsEyeKit"),
            ],
            path: "Sources/GodsEyeDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Gods Eye",
            dependencies: [
                "GodsEyeIPC",
                "GodsEyeDiscovery",
                .product(name: "GodsEyeKit", package: "GodsEyeKit"),
                .product(name: "GodsEyeChatUI", package: "GodsEyeKit"),
                .product(name: "GodsEyeProtocol", package: "GodsEyeKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/GodsEye.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "GodsEyeMacCLI",
            dependencies: [
                "GodsEyeDiscovery",
                .product(name: "GodsEyeKit", package: "GodsEyeKit"),
                .product(name: "GodsEyeProtocol", package: "GodsEyeKit"),
            ],
            path: "Sources/GodsEyeMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "GodsEyeIPCTests",
            dependencies: [
                "GodsEyeIPC",
                "Gods Eye",
                "GodsEyeDiscovery",
                .product(name: "GodsEyeProtocol", package: "GodsEyeKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
