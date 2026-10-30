/**
 * Saving text the page already holds as a file: a Blob URL on a throwaway link, behind a look's Export. The URL is
 * let go a moment after the click, once the browser has started the download (Safari needs it to live that long).
 * It throws only when the Blob or its URL can't be made; a download the browser blocks can't be seen from here, so
 * the editor says the download started, never that it arrived.
 */

export const DOWNLOAD_REVOKE_AFTER_MS = 1000

export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_AFTER_MS)
  }
}
