import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { PILOT_CITIES } from '../data/cities';
import { useApp } from '../state/AppState';

export function SuggestPage() {
  const { provider, online } = useApp();
  const [cityId, setCityId] = useState(PILOT_CITIES[0].id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaved(false);
    try {
      const result = await provider.submitReport(
        {
          restroomId: null,
          kind: 'missing-restroom',
          note: details,
          suggestion: { cityId, name, address, details },
        },
        { online },
      );
      setMessage(`${result.message} An admin has to add the place. This suggestion does not create a restroom by itself.`);
      setSaved(true);
    } catch (error) {
      setSaved(false);
      setMessage(error instanceof Error ? error.message : 'This suggestion was not saved.');
    }
  }

  return (
    <Shell title="Suggest a restroom">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1>Suggest a missing restroom</h1>
        <p>This is a suggestion for review. It does not become a listed restroom until an admin adds it.</p>
        <label className="field">
          Pilot city
          <select value={cityId} onChange={(event) => setCityId(event.target.value)}>
            {PILOT_CITIES.map((city) => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Place name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          Address
          <input value={address} onChange={(event) => setAddress(event.target.value)} required />
        </label>
        <label className="field">
          What should a reviewer know?
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} required />
        </label>
        <button type="submit" className="btn btn-secondary">Save suggestion</button>
        {message ? <p role="status" className={saved ? 'banner banner-ok' : 'banner banner-bad'}>{message}</p> : null}
        <Link to="/">Back home</Link>
      </form>
    </Shell>
  );
}
