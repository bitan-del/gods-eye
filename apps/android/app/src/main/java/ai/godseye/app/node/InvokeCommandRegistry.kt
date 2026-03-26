package ai.godseye.app.node

import ai.godseye.app.protocol.GodsEyeCalendarCommand
import ai.godseye.app.protocol.GodsEyeCanvasA2UICommand
import ai.godseye.app.protocol.GodsEyeCanvasCommand
import ai.godseye.app.protocol.GodsEyeCameraCommand
import ai.godseye.app.protocol.GodsEyeCapability
import ai.godseye.app.protocol.GodsEyeCallLogCommand
import ai.godseye.app.protocol.GodsEyeContactsCommand
import ai.godseye.app.protocol.GodsEyeDeviceCommand
import ai.godseye.app.protocol.GodsEyeLocationCommand
import ai.godseye.app.protocol.GodsEyeMotionCommand
import ai.godseye.app.protocol.GodsEyeNotificationsCommand
import ai.godseye.app.protocol.GodsEyePhotosCommand
import ai.godseye.app.protocol.GodsEyeSmsCommand
import ai.godseye.app.protocol.GodsEyeSystemCommand

data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val sendSmsAvailable: Boolean,
  val readSmsAvailable: Boolean,
  val callLogAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val debugBuild: Boolean,
)

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SendSmsAvailable,
  ReadSmsAvailable,
  CallLogAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  DebugBuild,
}

enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  CallLogAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = GodsEyeCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = GodsEyeCapability.Device.rawValue),
      NodeCapabilitySpec(name = GodsEyeCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = GodsEyeCapability.System.rawValue),
      NodeCapabilitySpec(
        name = GodsEyeCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = GodsEyeCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = GodsEyeCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(
        name = GodsEyeCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = GodsEyeCapability.Photos.rawValue),
      NodeCapabilitySpec(name = GodsEyeCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = GodsEyeCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = GodsEyeCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
      NodeCapabilitySpec(
        name = GodsEyeCapability.CallLog.rawValue,
        availability = NodeCapabilityAvailability.CallLogAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = GodsEyeCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = GodsEyeSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = GodsEyeCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = GodsEyeCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = GodsEyeLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = GodsEyeDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyePhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = GodsEyeMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = GodsEyeMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = GodsEyeSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SendSmsAvailable,
      ),
      InvokeCommandSpec(
        name = GodsEyeSmsCommand.Search.rawValue,
        availability = InvokeCommandAvailability.ReadSmsAvailable,
      ),
      InvokeCommandSpec(
        name = GodsEyeCallLogCommand.Search.rawValue,
        availability = InvokeCommandAvailability.CallLogAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> {
    return capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.sendSmsAvailable || flags.readSmsAvailable
          NodeCapabilityAvailability.CallLogAvailable -> flags.callLogAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }
      .map { it.name }
  }

  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> {
    return all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SendSmsAvailable -> flags.sendSmsAvailable
          InvokeCommandAvailability.ReadSmsAvailable -> flags.readSmsAvailable
          InvokeCommandAvailability.CallLogAvailable -> flags.callLogAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }
      .map { it.name }
  }
}
