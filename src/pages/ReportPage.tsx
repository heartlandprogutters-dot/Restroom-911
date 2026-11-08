import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { REPORT_LABEL } from '../domain/labels';
import type { ReportKind } from '../domain/types';
import { useDataset } from '../lib/useDataset';
import { useApp } from '../state/AppState';

const KINDS: ReportKind[] = [
  'locked-door',
  'closure',
  'wrong-hours',
  'purchase-required',
  'wrong-accessibility',
  'correction',
];

export function ReportPage() {
  const { id = '' } = useParams();
  const { provider, online } = useApp();
  const { restrooms } = useDataset();
  const restroom = restrooms.find((item) => item.id === id);
  const [kind, setKind] = useState<ReportKind>('locked-door');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setSaved(false);
    try {
      const result = await provider.submitReport({ restroomId: id, kind, note }, { online });
      setMessage(result.message);
      setSaved(true);
    } catch (error) {
      setSaved(false);
      setMessage(error instanceof Error ? error.message : 'This report was not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Report a problem">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1>Report a problem</h1>
        <p>{restroom ? restroom.name : 'This report stays separate from verified facts until an admin approves it.'}</p>
        <fieldset className="stack">
          <legend>What looks wrong?</legend>
          {KINDS.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="kind"
                data-testid={`report-kind-${option}`}
                checked={kind === option}
                onChange={() => setKind(option)}
              />{' '}
              {REPORT_LABEL[option]}
            </label>
          ))}
        </fieldset>
        <label className="field">
          Note
          <textarea data-testid="report-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} required />
        </label>
        <button type="submit" className="btn btn-secondary" data-testid="report-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save report'}
        </button>
        {message ? (
          <p role="status" data-testid="report-status" className={saved ? 'banner banner-ok' : 'banner banner-bad'}>
            {message}
          </p>
        ) : null}
        <Link to={`/r/${id}`}>Back to details</Link>
      </form>
    </Shell>
  );
}
