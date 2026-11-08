import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useApp } from '../state/AppState';

const SCORES = [1, 2, 3, 4, 5];

export function RatePage() {
  const { id = '' } = useParams();
  const { provider, online } = useApp();
  const [cleanliness, setCleanliness] = useState(0);
  const [easeOfAccess, setEase] = useState(0);
  const [overall, setOverall] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaved(false);
    try {
      const result = await provider.submitRating({ restroomId: id, cleanliness, easeOfAccess, overall }, { online });
      setMessage(result.message);
      setSaved(true);
    } catch (error) {
      setSaved(false);
      setMessage(error instanceof Error ? error.message : 'This rating was not saved.');
    }
  }

  return (
    <Shell title="Rate restroom">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1>Rate this restroom</h1>
        <p>Your rating stays on this device in demo mode and does not replace sample ratings or verified facts.</p>
        <ScoreGroup label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
        <ScoreGroup label="Ease of access" value={easeOfAccess} onChange={setEase} />
        <ScoreGroup label="Overall" value={overall} onChange={setOverall} />
        <button type="submit" className="btn btn-secondary" disabled={!cleanliness || !easeOfAccess || !overall}>
          Save rating
        </button>
        {message ? <p role="status" className={saved ? 'banner banner-ok' : 'banner banner-bad'}>{message}</p> : null}
        <Link to={`/r/${id}`}>Back to details</Link>
      </form>
    </Shell>
  );
}

function ScoreGroup({ label, value, onChange }: { label: string; value: number; onChange: (score: number) => void }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="seg" role="radiogroup" aria-label={label}>
        {SCORES.map((score) => (
          <button key={score} type="button" role="radio" aria-checked={value === score} onClick={() => onChange(score)}>
            {score}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
