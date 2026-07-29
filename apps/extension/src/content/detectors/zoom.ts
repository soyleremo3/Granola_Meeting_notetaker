import type { MeetingState, PageSnapshot } from "./types";

/** Any zoom.us subdomain (us05web.zoom.us, zoom.us, ...) with a join/web-client shaped path. */
export function isZoomMeetingUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const isZoomHost = host === "zoom.us" || host.endsWith(".zoom.us");
  if (!isZoomHost) return false;
  return /^\/(wc|j|s)\//.test(parsed.pathname);
}

/** Strictly the embedded web-client path — where tab-audio capture is actually meaningful. */
export function isZoomWebClientUrl(url: string): boolean {
  try {
    return /^\/wc\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

const LEAVE_LABEL_RE = /leave meeting|toplantıdan ayrıl/i;
const MIC_LABEL_RE = /mute my microphone|unmute my microphone|sesimi kapat|sesimi aç/i;
const VIDEO_LABEL_RE = /start video|stop video|videoyu başlat|videoyu durdur/i;
const ENDED_TEXT_RE =
  /meeting has ended|this meeting has been ended|you have left the meeting|toplantı sona erdi|toplantıdan ayrıldınız|host toplantıyı sonlandırdı/i;

// Shown on the pre-web-client launcher/download-prompt page. If this page never grows the actual
// web-client controls, the user is stuck trying to open the Zoom desktop app, which this
// extension cannot capture.
const DESKTOP_LAUNCHER_TEXT_RE =
  /launching zoom|open zoom meetings|zoom açılıyor|zoom toplantılarını aç|download & run zoom|indirip çalıştır/i;

export function classifyZoomState(snapshot: PageSnapshot): MeetingState {
  const hasEndedMarker = ENDED_TEXT_RE.test(snapshot.bodyText);

  if (!isZoomMeetingUrl(snapshot.url)) {
    return hasEndedMarker ? "ended" : "idle";
  }

  const hasLeaveButton = snapshot.ariaLabels.some((label) => LEAVE_LABEL_RE.test(label));
  const hasMicToggle = snapshot.ariaLabels.some((label) => MIC_LABEL_RE.test(label));
  const hasVideoToggle = snapshot.ariaLabels.some((label) => VIDEO_LABEL_RE.test(label));

  if (hasEndedMarker && !hasLeaveButton) return "ended";

  const controlScore = [hasLeaveButton, hasMicToggle, hasVideoToggle].filter(Boolean).length;
  if (controlScore >= 2) return "joined";

  return "idle";
}

/** True when the user is stuck on the "open the Zoom desktop app" launcher, not the web client. */
export function isZoomDesktopOnlyPrompt(snapshot: PageSnapshot): boolean {
  if (isZoomWebClientUrl(snapshot.url)) return false;
  if (!isZoomMeetingUrl(snapshot.url)) return false;
  if (classifyZoomState(snapshot) === "joined") return false;
  return DESKTOP_LAUNCHER_TEXT_RE.test(snapshot.bodyText);
}
