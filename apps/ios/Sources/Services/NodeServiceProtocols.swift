import CoreLocation
import Foundation
import GodsEyeKit
import UIKit

typealias GodsEyeCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias GodsEyeCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: GodsEyeCameraSnapParams) async throws -> GodsEyeCameraSnapResult
    func clip(params: GodsEyeCameraClipParams) async throws -> GodsEyeCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: GodsEyeLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: GodsEyeLocationGetParams,
        desiredAccuracy: GodsEyeLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: GodsEyeLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> GodsEyeDeviceStatusPayload
    func info() -> GodsEyeDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: GodsEyePhotosLatestParams) async throws -> GodsEyePhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: GodsEyeContactsSearchParams) async throws -> GodsEyeContactsSearchPayload
    func add(params: GodsEyeContactsAddParams) async throws -> GodsEyeContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: GodsEyeCalendarEventsParams) async throws -> GodsEyeCalendarEventsPayload
    func add(params: GodsEyeCalendarAddParams) async throws -> GodsEyeCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: GodsEyeRemindersListParams) async throws -> GodsEyeRemindersListPayload
    func add(params: GodsEyeRemindersAddParams) async throws -> GodsEyeRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: GodsEyeMotionActivityParams) async throws -> GodsEyeMotionActivityPayload
    func pedometer(params: GodsEyePedometerParams) async throws -> GodsEyePedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: GodsEyeWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
