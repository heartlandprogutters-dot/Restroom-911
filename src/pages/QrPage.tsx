import { Link, useParams } from 'react-router-dom';
import { FinishedVisit } from '../components/FinishedVisit';
import { Shell } from '../components/Shell';
import { datasetLabel } from '../domain/labels';
import { useDataset } from '../lib/useDataset';

export function QrPage() {
  const { slug = '' } = useParams();
  const { restrooms, loading, error } = useDataset();
  const match = restrooms
    .flatMap((restroom) => restroom.entrances.map((entrance) => ({ restroom, entrance })))
    .find((item) => item.entrance.slug === slug);

  return (
    <Shell title="QR directions">
      <article className="stack">
        <p className="note">Free QR guidance. No account needed.</p>
        {loading ? <p>Loading entrance…</p> : null}
        {error ? <p className="banner banner-bad">{error}</p> : null}
        {!loading && !match ? (
          <>
            <h1>QR code not recognized</h1>
            <p>This link does not match a demo entrance.</p>
          </>
        ) : null}
        {match ? (
          <>
            <p className="note">{datasetLabel(match.restroom.dataset, match.restroom.fictional)}</p>
            <h1>{match.restroom.name}</h1>
            <p>{match.restroom.address}</p>
            <h2>Directions from {match.entrance.name}</h2>
            <p data-testid="entrance-directions">{match.entrance.directions}</p>
            <p>These are written directions from a posted starting point. This is not indoor GPS and does not guarantee the fastest way.</p>
            {match.restroom.entrances.length > 1 ? (
              <section>
                <h2>Other starting points</h2>
                <ul>
                  {match.restroom.entrances
                    .filter((entrance) => entrance.slug !== slug)
                    .map((entrance) => (
                      <li key={entrance.id}>
                        <Link to={`/q/${entrance.slug}`}>{entrance.name}</Link>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
            <FinishedVisit />
            <Link to={`/r/${match.restroom.id}`}>Full details</Link>
          </>
        ) : null}
      </article>
    </Shell>
  );
}
