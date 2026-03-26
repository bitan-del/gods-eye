package ai.godseye.app.node

import ai.godseye.app.protocol.GodsEyeCalendarCommand
import ai.godseye.app.protocol.GodsEyeCameraCommand
import ai.godseye.app.protocol.GodsEyeCallLogCommand
import ai.godseye.app.protocol.GodsEyeCapability
import ai.godseye.app.protocol.GodsEyeContactsCommand
import ai.godseye.app.protocol.GodsEyeDeviceCommand
import ai.godseye.app.protocol.GodsEyeLocationCommand
import ai.godseye.app.protocol.GodsEyeMotionCommand
import ai.godseye.app.protocol.GodsEyeNotificationsCommand
import ai.godseye.app.protocol.GodsEyePhotosCommand
import ai.godseye.app.protocol.GodsEyeSmsCommand
import ai.godseye.app.protocol.GodsEyeSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      GodsEyeCapability.Canvas.rawValue,
      GodsEyeCapability.Device.rawValue,
      GodsEyeCapability.Notifications.rawValue,
      GodsEyeCapability.System.rawValue,
      GodsEyeCapability.Photos.rawValue,
      GodsEyeCapability.Contacts.rawValue,
      GodsEyeCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      GodsEyeCapability.Camera.rawValue,
      GodsEyeCapability.Location.rawValue,
      GodsEyeCapability.Sms.rawValue,
      GodsEyeCapability.CallLog.rawValue,
      GodsEyeCapability.VoiceWake.rawValue,
      GodsEyeCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      GodsEyeDeviceCommand.Status.rawValue,
      GodsEyeDeviceCommand.Info.rawValue,
      GodsEyeDeviceCommand.Permissions.rawValue,
      GodsEyeDeviceCommand.Health.rawValue,
      GodsEyeNotificationsCommand.List.rawValue,
      GodsEyeNotificationsCommand.Actions.rawValue,
      GodsEyeSystemCommand.Notify.rawValue,
      GodsEyePhotosCommand.Latest.rawValue,
      GodsEyeContactsCommand.Search.rawValue,
      GodsEyeContactsCommand.Add.rawValue,
      GodsEyeCalendarCommand.Events.rawValue,
      GodsEyeCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      GodsEyeCameraCommand.Snap.rawValue,
      GodsEyeCameraCommand.Clip.rawValue,
      GodsEyeCameraCommand.List.rawValue,
      GodsEyeLocationCommand.Get.rawValue,
      GodsEyeMotionCommand.Activity.rawValue,
      GodsEyeMotionCommand.Pedometer.rawValue,
      GodsEyeSmsCommand.Send.rawValue,
      GodsEyeSmsCommand.Search.rawValue,
      GodsEyeCallLogCommand.Search.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          callLogAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          callLogAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          callLogAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(GodsEyeMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(GodsEyeMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )

    assertTrue(readOnlyCommands.contains(GodsEyeSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(GodsEyeSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(GodsEyeSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(GodsEyeSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )

    assertTrue(readOnlyCapabilities.contains(GodsEyeCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(GodsEyeCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(GodsEyeCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(GodsEyeCapability.CallLog.rawValue))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    callLogAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      callLogAvailable = callLogAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
