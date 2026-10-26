import { useEffect, useRef, useState } from 'react';
import styles from './parent.module.css';

/**
 * Scans a QR code with the camera (the native BarcodeDetector where the browser has it, jsQR otherwise) and reports
 * the decoded text. Closes the camera when unmounted.
 */
export function QrScanner({ onText }: { onText: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'אין הרשאה למצלמה. אפשר להקליד את הקוד במקום.'
            : 'לא ניתן לפתוח את המצלמה. אפשר להקליד את הקוד במקום.',
        );
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (o: object) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
        }
      ).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
      const jsQR = detector ? null : (await import('jsqr')).default;
      const tick = async () => {
        if (stopped || !video.current) return;
        const v = video.current;
        if (v.readyState >= 2) {
          let text: string | undefined;
          if (detector) text = (await detector.detect(v).catch(() => []))[0]?.rawValue;
          else if (jsQR && context) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            context.drawImage(v, 0, 0);
            text = jsQR(
              context.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            )?.data;
          }
          if (text) return onText(text);
        }
        frame = requestAnimationFrame(() => void tick());
      };
      void tick();
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onText]);

  return error ? (
    <p className={styles.danger} role="alert">
      {error}
    </p>
  ) : (
    <video ref={video} className={styles.scanner} muted playsInline aria-label="מצלמה לסריקת קוד" />
  );
}
