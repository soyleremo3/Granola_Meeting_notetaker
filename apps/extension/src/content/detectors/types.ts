/**
 * A cheap, serializable description of "what the page currently looks like" — built once per
 * debounced DOM scan (see content-script wiring) and handed to the pure classifiers below so
 * detection logic can be unit-tested without a real DOM.
 */
export interface PageSnapshot {
  url: string;
  /** aria-label attribute values from buttons/controls currently in the DOM. */
  ariaLabels: string[];
  /** Visible text content of a bounded root element (not the whole page), for marker phrases. */
  bodyText: string;
}

export type MeetingState = "idle" | "joined" | "ended";
