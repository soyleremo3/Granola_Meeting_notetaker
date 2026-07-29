import { CONSENT_REMINDER_TEXT, ZOOM_DESKTOP_ONLY_MESSAGE } from "../lib/constants";

const BANNER_ID = "not-defteri-banner";

export function removeBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

function mountBanner(className: string): HTMLDivElement {
  removeBanner();
  const el = document.createElement("div");
  el.id = BANNER_ID;
  el.className = className;
  (document.documentElement ?? document.body).appendChild(el);
  return el;
}

export function showDetectedBanner(onStart: () => void, onDismiss: () => void): void {
  const el = mountBanner("");
  el.innerHTML = `
    <div class="nd-banner__main">
      <span class="nd-banner__dot"></span>
      <span class="nd-banner__text">Toplantı algılandı</span>
      <button type="button" class="nd-banner__btn nd-banner__btn--primary" data-action="start">Kaydı Başlat</button>
      <button type="button" class="nd-banner__btn" data-action="dismiss">Şimdi Değil</button>
    </div>
    <span class="nd-banner__consent"></span>
  `;
  const consentEl = el.querySelector(".nd-banner__consent");
  if (consentEl) consentEl.textContent = CONSENT_REMINDER_TEXT;
  el.querySelector('[data-action="start"]')?.addEventListener("click", onStart);
  el.querySelector('[data-action="dismiss"]')?.addEventListener("click", onDismiss);
}

export function showRecordingBanner(onStop: () => void, elapsedLabel: string): void {
  const existing = document.getElementById(BANNER_ID);
  if (existing?.dataset.variant === "recording") {
    const textEl = existing.querySelector(".nd-banner__text");
    if (textEl) textEl.textContent = `Kayıt yapılıyor · ${elapsedLabel}`;
    return;
  }

  const el = mountBanner("");
  el.dataset.variant = "recording";
  el.innerHTML = `
    <div class="nd-banner__main">
      <span class="nd-banner__dot nd-banner__dot--live"></span>
      <span class="nd-banner__text">Kayıt yapılıyor · ${elapsedLabel}</span>
      <button type="button" class="nd-banner__btn nd-banner__btn--danger" data-action="stop">Kaydı Durdur</button>
    </div>
  `;
  el.querySelector('[data-action="stop"]')?.addEventListener("click", onStop);
}

export function showZoomDesktopOnlyNotice(): void {
  const el = mountBanner("nd-banner--warning");
  el.textContent = ZOOM_DESKTOP_ONLY_MESSAGE;
}
