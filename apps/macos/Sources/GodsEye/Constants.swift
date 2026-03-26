import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-godseye writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.godseye.mac"
let gatewayLaunchdLabel = "ai.godseye.gateway"
let onboardingVersionKey = "godseye.onboardingVersion"
let onboardingSeenKey = "godseye.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "godseye.pauseEnabled"
let iconAnimationsEnabledKey = "godseye.iconAnimationsEnabled"
let swabbleEnabledKey = "godseye.swabbleEnabled"
let swabbleTriggersKey = "godseye.swabbleTriggers"
let voiceWakeTriggerChimeKey = "godseye.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "godseye.voiceWakeSendChime"
let showDockIconKey = "godseye.showDockIcon"
let defaultVoiceWakeTriggers = ["godseye"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "godseye.voiceWakeMicID"
let voiceWakeMicNameKey = "godseye.voiceWakeMicName"
let voiceWakeLocaleKey = "godseye.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "godseye.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "godseye.voicePushToTalkEnabled"
let talkEnabledKey = "godseye.talkEnabled"
let iconOverrideKey = "godseye.iconOverride"
let connectionModeKey = "godseye.connectionMode"
let remoteTargetKey = "godseye.remoteTarget"
let remoteIdentityKey = "godseye.remoteIdentity"
let remoteProjectRootKey = "godseye.remoteProjectRoot"
let remoteCliPathKey = "godseye.remoteCliPath"
let canvasEnabledKey = "godseye.canvasEnabled"
let cameraEnabledKey = "godseye.cameraEnabled"
let systemRunPolicyKey = "godseye.systemRunPolicy"
let systemRunAllowlistKey = "godseye.systemRunAllowlist"
let systemRunEnabledKey = "godseye.systemRunEnabled"
let locationModeKey = "godseye.locationMode"
let locationPreciseKey = "godseye.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "godseye.peekabooBridgeEnabled"
let deepLinkKeyKey = "godseye.deepLinkKey"
let modelCatalogPathKey = "godseye.modelCatalogPath"
let modelCatalogReloadKey = "godseye.modelCatalogReload"
let cliInstallPromptedVersionKey = "godseye.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "godseye.heartbeatsEnabled"
let debugPaneEnabledKey = "godseye.debugPaneEnabled"
let debugFileLogEnabledKey = "godseye.debug.fileLogEnabled"
let appLogLevelKey = "godseye.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
