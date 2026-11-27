// Publishing hook shared by the public page and the Submit button.
//
// Leave submitUrl empty until the Apps Script web app is deployed, then paste
// the /exec URL here. Submit POSTs the public JSON there (Content-Type
// text/plain) and results.html loads the same address with GET.
//
// Do not put the passcode, a token, or a Google password in this file.
// The passcode lives on the phone and in the Sheet's script properties.

export const RESULTS_CONFIG = {
  resultsUrl: "./results.json",
  submitUrl: "",
};

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isLocalTestUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (url.protocol === "http:" || url.protocol === "https:") && (host === "127.0.0.1" || host === "localhost");
  } catch {
    return false;
  }
}

export function activeSubmitUrl() {
  try {
    const injected = globalThis.window?.__FF_SUBMIT_URL__;
    if (injected === "") return "";
    if (typeof injected === "string" && isLocalTestUrl(injected.trim())) return injected.trim();
  } catch {
    /* no window while testing the publisher in Node */
  }
  const configured = String(RESULTS_CONFIG.submitUrl || "").trim();
  if (isHttpUrl(configured)) return configured;
  return "";
}
