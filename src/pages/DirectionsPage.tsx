import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FinishedVisit } from '../components/FinishedVisit';
import { MapsLinks } from '../components/MapsLinks';
import { Shell } from '../components/Shell';
import { useDataset } from '../lib/useDataset';

export function DirectionsPage() {
  const { id = '' } = useParams();
  const { restrooms, loading, error } = useDataset();
  const restroom = restrooms.find((item) => item.id === id) ?? null;
  const [entranceId, setEntranceId] = useState<string | null>(null);
  const entrance = restroom?.entrances.find((item) => item.id === (entranceId ?? restroom.entrances[0]?.id)) ?? null;

  return (
    <Shell title="Directions">
      {loading ? <p>Loading directions…</p> : null}
      {error ? <p className="banner banner-bad" role="alert">{error}</p> : null}
      {!loading && !restroom ? <p>This restroom is not in the current dataset.</p> : null}
      {restroom ? (
        <article className="stack">
          <h1>Directions to {restroom.name}</h1>
          <p>Written directions start from a known entrance or QR sign. This is not indoor GPS.</p>
          {restroom.entrances.length > 1 ? (
            <label className="field">
              Starting point
              <select value={entrance?.id ?? ''} onChange={(event) => setEntranceId(event.target.value)}>
                {restroom.entrances.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <section>
            <h2>From the entrance</h2>
            <p data-testid="entrance-directions">{entrance?.directions ?? restroom.entranceSummary ?? 'Unknown'}</p>
          </section>
          <section>
            <h2>Indoors</h2>
            <p>{restroom.indoorSummary ?? entrance?.directions ?? 'Unknown'}</p>
          </section>
          <MapsLinks restroom={restroom} />
          <FinishedVisit />
          <Link to={`/r/${restroom.id}`}>Back to details</Link>
        </article>
      ) : null}
    </Shell>
  );
}
