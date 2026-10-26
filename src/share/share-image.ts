export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Shares an image through the system share sheet (Web Share API with files, which reaches WhatsApp and the like), or
 * downloads it when the device cannot share files. A share the user dismisses is "cancelled", not an error.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
  nav: Navigator = navigator,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Any other failure falls back to saving the image.
    }
  }
  download(blob, filename);
  return 'downloaded';
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
