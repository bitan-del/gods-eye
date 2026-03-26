// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "GodsEyeKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "GodsEyeProtocol", targets: ["GodsEyeProtocol"]),
        .library(name: "GodsEyeKit", targets: ["GodsEyeKit"]),
        .library(name: "GodsEyeChatUI", targets: ["GodsEyeChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "GodsEyeProtocol",
            path: "Sources/GodsEyeProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "GodsEyeKit",
            dependencies: [
                "GodsEyeProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/GodsEyeKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "GodsEyeChatUI",
            dependencies: [
                "GodsEyeKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/GodsEyeChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "GodsEyeKitTests",
            dependencies: ["GodsEyeKit", "GodsEyeChatUI"],
            path: "Tests/GodsEyeKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
