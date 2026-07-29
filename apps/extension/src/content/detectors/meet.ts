import type { MeetingState, PageSnapshot } from "./types";

// Meeting codes look like "abc-defg-hij"; other meet.google.com paths (landing, lookup, root)
// are never an actual call and must not be treated as one.
const MEETING_CODE_PATH_RE = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
const NON_MEETING_PATHS = new Set(["/", "/landing", "/_meet", "/lookup"]);

export function isMeetUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname !== "meet.google.com") return false;
  if (NON_MEETING_PATHS.has(parsed.pathname)) return false;
  return MEETING_CODE_PATH_RE.test(parsed.pathname);
}

// Language-agnostic (Meet's UI locale follows the user's Google account, not the page): match
// both English and Turkish labels rather than relying on one fixed string or CSS class.
const LEAVE_LABEL_RE = /leave call|çağrıdan ayrıl|aramadan ayrıl|görüşmeden ayrıl/i;
const MIC_LABEL_RE = /microphone|mikrofon/i;
const CAMERA_LABEL_RE = /camera|kamera/i;
const JOIN_LABEL_RE = /join now|şimdi katıl/i;
const ENDED_TEXT_RE =
  /you left the meeting|aramadan ayrıldınız|görüşmeden ayrıldınız|call ended|görüşme sona erdi|return to home screen|ana ekrana dön|rejoin|yeniden katıl/i;

/**
 * Classifies a single DOM snapshot as idle / joined / ended using several independent signals
 * (URL shape, control aria-labels, absence of the pre-join button, post-call marker text) rather
 * than one fragile CSS class. The caller is responsible for debouncing and requiring the "ended"
 * verdict to be stable across consecutive scans before acting on it.
 */
export function classifyMeetState(snapshot: PageSnapshot): MeetingState {
  const hasEndedMarker = ENDED_TEXT_RE.test(snapshot.bodyText);

  if (!isMeetUrl(snapshot.url)) {
    return hasEndedMarker ? "ended" : "idle";
  }

  const hasLeaveButton = snapshot.ariaLabels.some((label) => LEAVE_LABEL_RE.test(label));
  const hasMicToggle = snapshot.ariaLabels.some((label) => MIC_LABEL_RE.test(label));
  const hasCameraToggle = snapshot.ariaLabels.some((label) => CAMERA_LABEL_RE.test(label));
  const hasJoinButton = snapshot.ariaLabels.some((label) => JOIN_LABEL_RE.test(label));

  if (hasEndedMarker && !hasLeaveButton) return "ended";

  const controlScore = [hasLeaveButton, hasMicToggle, hasCameraToggle].filter(Boolean).length;
  if (!hasJoinButton && controlScore >= 2) return "joined";

  return "idle";
}
