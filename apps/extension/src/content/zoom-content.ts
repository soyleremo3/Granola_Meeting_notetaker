import { classifyZoomState, isZoomDesktopOnlyPrompt } from "./detectors/zoom";
import { startContentRuntime } from "./content-runtime";

startContentRuntime({
  platform: "zoom",
  classify: classifyZoomState,
  isDesktopOnlyPrompt: isZoomDesktopOnlyPrompt,
  settingsEnabledKey: "zoomDetectionEnabled",
});
