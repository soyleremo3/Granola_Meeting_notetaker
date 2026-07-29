import { classifyMeetState } from "./detectors/meet";
import { startContentRuntime } from "./content-runtime";

startContentRuntime({
  platform: "meet",
  classify: classifyMeetState,
  settingsEnabledKey: "meetDetectionEnabled",
});
