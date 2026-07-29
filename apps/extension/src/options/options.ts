import { DEFAULT_SETTINGS, loadSettings, normalizeUrl, saveSettings, validateUrl } from "../lib/settings";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Beklenen ayarlar öğesi bulunamadı: #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>("settings-form");
const backendUrlInput = byId<HTMLInputElement>("backend-url");
const backendUrlError = byId<HTMLElement>("backend-url-error");
const frontendUrlInput = byId<HTMLInputElement>("frontend-url");
const frontendUrlError = byId<HTMLElement>("frontend-url-error");
const meetDetectionInput = byId<HTMLInputElement>("meet-detection");
const zoomDetectionInput = byId<HTMLInputElement>("zoom-detection");
const inPageBannerInput = byId<HTMLInputElement>("in-page-banner");
const autoStopInput = byId<HTMLInputElement>("auto-stop");
const autoOpenResultInput = byId<HTMLInputElement>("auto-open-result");
const saveStatus = byId<HTMLElement>("save-status");

async function populateForm(): Promise<void> {
  const settings = await loadSettings();
  backendUrlInput.value = settings.backendUrl;
  frontendUrlInput.value = settings.frontendUrl;
  meetDetectionInput.checked = settings.meetDetectionEnabled;
  zoomDetectionInput.checked = settings.zoomDetectionEnabled;
  inPageBannerInput.checked = settings.inPageBannerEnabled;
  autoStopInput.checked = settings.autoStopEnabled;
  autoOpenResultInput.checked = settings.autoOpenResultEnabled;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveStatus.textContent = "";
  backendUrlError.textContent = "";
  frontendUrlError.textContent = "";

  const backendCheck = validateUrl(backendUrlInput.value);
  const frontendCheck = validateUrl(frontendUrlInput.value);

  if (!backendCheck.valid) backendUrlError.textContent = backendCheck.error ?? "";
  if (!frontendCheck.valid) frontendUrlError.textContent = frontendCheck.error ?? "";
  if (!backendCheck.valid || !frontendCheck.valid) return;

  void saveSettings({
    backendUrl: normalizeUrl(backendUrlInput.value),
    frontendUrl: normalizeUrl(frontendUrlInput.value),
    meetDetectionEnabled: meetDetectionInput.checked,
    zoomDetectionEnabled: zoomDetectionInput.checked,
    inPageBannerEnabled: inPageBannerInput.checked,
    autoStopEnabled: autoStopInput.checked,
    autoOpenResultEnabled: autoOpenResultInput.checked,
  }).then(() => {
    saveStatus.textContent = "Kaydedildi.";
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 2000);
  });
});

// Keep a visible default even before the async load resolves.
backendUrlInput.placeholder = DEFAULT_SETTINGS.backendUrl;
frontendUrlInput.placeholder = DEFAULT_SETTINGS.frontendUrl;

void populateForm();
