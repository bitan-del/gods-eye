import Foundation

public enum GodsEyeCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum GodsEyeCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum GodsEyeCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum GodsEyeCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct GodsEyeCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: GodsEyeCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: GodsEyeCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: GodsEyeCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: GodsEyeCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct GodsEyeCameraClipParams: Codable, Sendable, Equatable {
    public var facing: GodsEyeCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: GodsEyeCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: GodsEyeCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: GodsEyeCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
