import { Link } from 'react-router-dom';
import { cityById } from '../data/cities';
import { formatDistance } from '../domain/geo';
import { ACCESS_LABEL, TRI_LABEL, datasetLabel } from '../domain/labels';
import type { RankedRestroom } from '../domain/ranking';

export function RestroomCard({ ranked, featured = false }: { ranked: RankedRestroom; featured?: boolean }) {
  const { restroom, travel, open, explanation, delayNote, peer } = ranked;
  const city = cityById(restroom.cityId);
  return (
    <article className={featured ? 'card card-best' : 'card'} data-testid={featured ? 'results-best' : 'results-alt'}>
      <p className="note">{datasetLabel(restroom.dataset, restroom.fictional)}</p>
      <h3 style={{ margin: '0.2rem 0' }}>{restroom.name}</h3>
      <p>{explanation}</p>
      <p>
        {travel.method === 'straight-line' ? (
          <>Approximate distance: {formatDistance(travel.distanceMeters)} straight-line. Travel time is not shown.</>
        ) : (
          <>
            Route distance: {formatDistance(travel.distanceMeters)}.
            {travel.travelTimeMinutes != null
              ? ` Estimated travel time: ${Math.max(1, Math.round(travel.travelTimeMinutes))} min from the configured routing provider. Not a guarantee of the fastest route.`
              : ' The routing provider did not return a travel time.'}
          </>
        )}
      </p>
      {delayNote ? <p>{delayNote}</p> : null}
      <p>
        {open.label}
        {open.detail ? ` · ${open.detail}` : ''}
      </p>
      <p>Access: {ACCESS_LABEL[restroom.access]}</p>
      <p>
        Wheelchair: {TRI_LABEL[restroom.wheelchair]} · Stalls: {restroom.stallType === 'unknown' ? 'Unknown' : restroom.stallType === 'single-user' ? 'Single-user' : 'Multi-stall'} · Changing table: {TRI_LABEL[restroom.changingTable]}
      </p>
      <p>
        {peer.sampleOverall != null
          ? `Sample rating ${peer.sampleOverall.toFixed(1)} overall (${peer.sampleCount} sample ratings).`
          : 'Sample rating: unknown.'}{' '}
        Sample ratings are not real reviews.
      </p>
      <p>{restroom.address}{city ? ` · ${city.name}` : ''}</p>
      {restroom.entranceSummary ? <p>Entrance: {restroom.entranceSummary}</p> : <p>Entrance directions: Unknown</p>}
      <p className="note">
        {restroom.verifiedAt
          ? `Last marked reviewed ${restroom.verifiedAt.slice(0, 10)}. Source: ${restroom.verificationSource ?? 'Unknown'}.`
          : 'Last verification: unknown.'}
      </p>
      <div className="btn-row">
        <Link className="btn btn-secondary" to={`/r/${restroom.id}`}>Details</Link>
        <Link className="btn btn-ghost" to={`/r/${restroom.id}/directions`}>Directions</Link>
      </div>
    </article>
  );
}
