import { Link, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { formatHoursList, formatTimestamp, getOpenStatus } from '../domain/hours';
import { ACCESS_LABEL, REPORT_LABEL, STALL_LABEL, TRI_LABEL, datasetLabel } from '../domain/labels';
import { factOverlay, overlayWarnings } from '../domain/moderation';
import { peerRating } from '../domain/ranking';
import type { Rating, Report, Restroom, SampleRating } from '../domain/types';
import { useDataset } from '../lib/useDataset';

export function DetailsPage() {
  const { id = '' } = useParams();
  const { restrooms, reports, ratings, loading, error } = useDataset();
  const restroom = restrooms.find((item) => item.id === id) ?? null;
  const related = reports.filter((report) => report.restroomId === id);
  const now = new Date();

  return (
    <Shell title={restroom?.name ?? 'Restroom'}>
      {loading ? <p role="status">Loading restroom…</p> : null}
      {error ? <p className="banner banner-bad" role="alert">{error}</p> : null}
      {!loading && !error && !restroom ? (
        <>
          <h1>Restroom not found</h1>
          <p>This id is not in the current dataset.</p>
          <Link className="btn btn-secondary" to="/">Back home</Link>
        </>
      ) : null}
      {restroom ? <DetailBody restroom={restroom} related={related} ratings={ratings} now={now} /> : null}
    </Shell>
  );
}

function DetailBody({
  restroom,
  related,
  ratings,
  now,
}: {
  restroom: Restroom;
  related: Report[];
  ratings: Rating[];
  now: Date;
}) {
  const open = getOpenStatus(restroom.hours, restroom.timeZone, now);
  const peer = peerRating(restroom, ratings);
  const overlay = factOverlay(restroom, related, now);
  const warnings = overlayWarnings(overlay);
  const pending = related.filter((report) => report.status === 'pending');
  const approved = related.filter((report) => report.status === 'approved');
  const rejected = related.filter((report) => report.status === 'rejected');

  return (
    <article className="stack">
      <p className="note">{datasetLabel(restroom.dataset, restroom.fictional)}</p>
      <h1>{restroom.name}</h1>
      <p>{restroom.address}</p>
      {restroom.fictional ? (
        <p className="banner">
          Fictional demo place. Verification notes are sample or demo-admin entries, not a real inspection.
        </p>
      ) : null}
      <section>
        <h2>Hours</h2>
        <p>
          {open.label}
          {open.detail ? ` · ${open.detail}` : ''}
        </p>
        <ul>
          {formatHoursList(restroom.hours).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="note">Listed hours are not a promise that the restroom is free.</p>
      </section>
      <dl className="fact-list">
        <dt>Access</dt>
        <dd>{ACCESS_LABEL[restroom.access]}</dd>
        <dt>Wheelchair accessible</dt>
        <dd>{TRI_LABEL[restroom.wheelchair]}</dd>
        <dt>Stalls</dt>
        <dd>{STALL_LABEL[restroom.stallType]}</dd>
        <dt>Family restroom</dt>
        <dd>{TRI_LABEL[restroom.familyRestroom]}</dd>
        <dt>Changing table</dt>
        <dd>{TRI_LABEL[restroom.changingTable]}</dd>
        <dt>Gender-neutral</dt>
        <dd>{TRI_LABEL[restroom.genderNeutral]}</dd>
        <dt>Parking delay</dt>
        <dd>{minutes(restroom.parkingDelayMin)}</dd>
        <dt>Entrance delay</dt>
        <dd>{minutes(restroom.entranceDelayMin)}</dd>
        <dt>Indoor walk</dt>
        <dd>{minutes(restroom.indoorWalkMin)}</dd>
        <dt>Entrance</dt>
        <dd>{restroom.entranceSummary ?? 'Unknown'}</dd>
        <dt>Indoors</dt>
        <dd>{restroom.indoorSummary ?? 'Unknown'}</dd>
      </dl>
      <section>
        <h2>Ratings</h2>
        <SampleRatings sample={restroom.sampleRating} />
        <p>
          {peer.deviceCount > 0
            ? `Ratings saved on this device: ${peer.deviceCount}. They stay separate from sample ratings.`
            : 'No ratings saved on this device yet.'}
        </p>
      </section>
      <section>
        <h2>Verification</h2>
        {restroom.verificationHistory.length === 0 ? (
          <p>Unknown. No verification history is recorded.</p>
        ) : (
          <ul>
            {restroom.verificationHistory.map((entry) => (
              <li key={`${entry.at}-${entry.source}`}>
                {formatTimestamp(entry.at, restroom.timeZone)} — {entry.source}. {entry.note}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Reports</h2>
        {warnings.map((warning) => (
          <p key={warning} className="banner">{warning}</p>
        ))}
        {related.length === 0 ? <p>No reports yet.</p> : null}
        {pending.map((report) => (
          <p key={report.id}>
            {report.sample ? 'Sample report. ' : ''}
            {REPORT_LABEL[report.kind]}: {report.note} Pending review. Not applied to facts or ranking.
          </p>
        ))}
        {approved.map((report) => (
          <p key={report.id}>
            {report.sample ? 'Sample report. ' : ''}
            Approved — {REPORT_LABEL[report.kind]}: {report.note}
          </p>
        ))}
        {rejected.map((report) => (
          <p key={report.id}>Rejected — {REPORT_LABEL[report.kind]}. Not applied.</p>
        ))}
      </section>
      <div className="btn-row">
        <Link className="btn btn-secondary" to={`/r/${restroom.id}/directions`}>Directions</Link>
        <Link className="btn btn-ghost" to={`/r/${restroom.id}/report`} data-testid="report-problem">
          Report a problem
        </Link>
        <Link className="btn btn-ghost" to={`/r/${restroom.id}/rate`}>Rate this restroom</Link>
      </div>
      {restroom.entrances.length > 0 ? (
        <section>
          <h2>QR starting points</h2>
          <ul>
            {restroom.entrances.map((entrance) => (
              <li key={entrance.id}>
                <Link to={`/q/${entrance.slug}`}>{entrance.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function minutes(value: number | null): string {
  return value == null ? 'Unknown' : `${value} min, sample estimate`;
}

function SampleRatings({ sample }: { sample: SampleRating | null }) {
  if (!sample) return <p>Sample rating: unknown.</p>;
  return (
    <>
      <p>
        Sample rating {sample.overall.toFixed(1)} overall ({sample.count} sample ratings). Sample ratings are not
        real reviews.
      </p>
      <p>
        Cleanliness (sample): {sample.cleanliness.toFixed(1)}. Ease of access (sample): {sample.easeOfAccess.toFixed(1)}.
      </p>
    </>
  );
}
