// Saving a file from the browser: a Blob URL on a throwaway link. The URL is revoked a moment
// later, once the browser has started the download (Safari needs it to live that long).

const REVOKE_AFTER_MS = 1000;

/** Starts a download of `blob` as `fileName`. Throws if the browser refuses; callers say so. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}

/** Starts a download of `text` as `fileName`. Throws if the browser refuses; callers say so. */
export function downloadText(fileName: string, text: string, type: string): void {
  downloadBlob(fileName, new Blob([text], { type }));
}
