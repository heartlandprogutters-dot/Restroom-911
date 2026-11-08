import { useEffect, useState } from 'react';
import { absoluteAppUrl } from '../lib/url';

export function QrImage({ path, label }: { path: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const link = absoluteAppUrl(path);

  useEffect(() => {
    let cancel = false;
    import('qrcode')
      .then((QR) => QR.toDataURL(link, { margin: 1, width: 280, errorCorrectionLevel: 'M' }))
      .then((data) => {
        if (!cancel) setSrc(data);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [link]);

  return (
    <div className="stack-tight">
      {failed ? <p>QR image could not be created. Use the link.</p> : null}
      {!failed && !src ? <p>Preparing QR code…</p> : null}
      {src ? <img src={src} alt={`QR code for ${label}`} width={220} height={220} /> : null}
      <a href={link}>{label}</a>
    </div>
  );
}
