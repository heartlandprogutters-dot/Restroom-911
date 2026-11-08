import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { useApp } from '../state/AppState';

export function DataBadge() {
  const { mode, online } = useApp();
  const label = mode === 'demo' ? 'Demo data' : 'Server sandbox';
  return (
    <p className="badge" data-testid="data-badge">
      <span className="badge-dot" aria-hidden="true" />
      {label}
      {online ? '' : ' · offline copy'}
    </p>
  );
}

export function OfflineBanner() {
  const { online, packagedOn } = useApp();
  if (online) return null;
  return (
    <p className="banner" role="status" data-testid="offline-banner">
      You are offline. Demo information packaged on {packagedOn} can still be shown. It is not a live update.
      A report is not sent to a server while you are offline.
    </p>
  );
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ${brand.name}`;
  }, [title]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <Link className="brand" to="/">{brand.name}</Link>
        <DataBadge />
      </header>
      <div className="wrap">
        <OfflineBanner />
        <main id="main">{children}</main>
      </div>
      <footer className="site-footer">
        <p>{brand.emergencyNotice}</p>
        <p>{brand.demoWarning}</p>
        <p>Formerly {brand.formerName}.</p>
        <nav className="footer-links" aria-label="More">
          <Link to="/qr">Sample QR codes</Link>
          <Link to="/suggest">Suggest a missing restroom</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </footer>
    </>
  );
}
