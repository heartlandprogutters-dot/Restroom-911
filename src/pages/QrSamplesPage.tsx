import { QrImage } from '../components/QrImage';
import { Shell } from '../components/Shell';
import { useDataset } from '../lib/useDataset';

const FIRST = ['mayfield-welcome-kiosk', 'murray-commons'];

export function QrSamplesPage() {
  const { restrooms, loading } = useDataset();
  const ordered = [...restrooms].sort((a, b) => {
    const aFirst = FIRST.indexOf(a.id);
    const bFirst = FIRST.indexOf(b.id);
    if (aFirst === -1 && bFirst === -1) return a.name.localeCompare(b.name);
    if (aFirst === -1) return 1;
    if (bFirst === -1) return -1;
    return aFirst - bFirst;
  });

  return (
    <Shell title="Sample QR codes">
      <div className="stack">
        <h1>Sample QR codes</h1>
        <p>
          Scan one with your phone while this page is open, or tap the link. No account is required. These entrances
          are fictional demo starting points.
        </p>
        {loading ? <p>Loading sample entrances…</p> : null}
        {ordered
          .filter((restroom) => restroom.entrances.length > 0)
          .map((restroom) => (
            <section key={restroom.id} className="card stack">
              <h2>{restroom.name}</h2>
              {restroom.entrances.map((entrance) => (
                <QrImage key={entrance.id} path={`q/${entrance.slug}`} label={`${entrance.name} directions`} />
              ))}
            </section>
          ))}
      </div>
    </Shell>
  );
}
