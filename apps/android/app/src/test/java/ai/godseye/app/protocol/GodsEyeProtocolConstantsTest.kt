package ai.godseye.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class GodsEyeProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", GodsEyeCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", GodsEyeCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", GodsEyeCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", GodsEyeCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", GodsEyeCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", GodsEyeCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", GodsEyeCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", GodsEyeCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", GodsEyeCapability.Canvas.rawValue)
    assertEquals("camera", GodsEyeCapability.Camera.rawValue)
    assertEquals("voiceWake", GodsEyeCapability.VoiceWake.rawValue)
    assertEquals("location", GodsEyeCapability.Location.rawValue)
    assertEquals("sms", GodsEyeCapability.Sms.rawValue)
    assertEquals("device", GodsEyeCapability.Device.rawValue)
    assertEquals("notifications", GodsEyeCapability.Notifications.rawValue)
    assertEquals("system", GodsEyeCapability.System.rawValue)
    assertEquals("photos", GodsEyeCapability.Photos.rawValue)
    assertEquals("contacts", GodsEyeCapability.Contacts.rawValue)
    assertEquals("calendar", GodsEyeCapability.Calendar.rawValue)
    assertEquals("motion", GodsEyeCapability.Motion.rawValue)
    assertEquals("callLog", GodsEyeCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", GodsEyeCameraCommand.List.rawValue)
    assertEquals("camera.snap", GodsEyeCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", GodsEyeCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", GodsEyeNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", GodsEyeNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", GodsEyeDeviceCommand.Status.rawValue)
    assertEquals("device.info", GodsEyeDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", GodsEyeDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", GodsEyeDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", GodsEyeSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", GodsEyePhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", GodsEyeContactsCommand.Search.rawValue)
    assertEquals("contacts.add", GodsEyeContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", GodsEyeCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", GodsEyeCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", GodsEyeMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", GodsEyeMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", GodsEyeCallLogCommand.Search.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.search", GodsEyeSmsCommand.Search.rawValue)
  }
}
