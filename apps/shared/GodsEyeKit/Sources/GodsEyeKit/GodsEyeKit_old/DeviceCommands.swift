import Foundation

public enum GodsEyeDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum GodsEyeBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum GodsEyeThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum GodsEyeNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum GodsEyeNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct GodsEyeBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: GodsEyeBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: GodsEyeBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct GodsEyeThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: GodsEyeThermalState

    public init(state: GodsEyeThermalState) {
        self.state = state
    }
}

public struct GodsEyeStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct GodsEyeNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: GodsEyeNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [GodsEyeNetworkInterfaceType]

    public init(
        status: GodsEyeNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [GodsEyeNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct GodsEyeDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: GodsEyeBatteryStatusPayload
    public var thermal: GodsEyeThermalStatusPayload
    public var storage: GodsEyeStorageStatusPayload
    public var network: GodsEyeNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: GodsEyeBatteryStatusPayload,
        thermal: GodsEyeThermalStatusPayload,
        storage: GodsEyeStorageStatusPayload,
        network: GodsEyeNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct GodsEyeDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
