import { useEffect, useState } from 'react';
import { QrImage } from '../components/QrImage';
import { Shell } from '../components/Shell';
import { PILOT_CITIES, cityById } from '../data/cities';
import { REPORT_LABEL } from '../domain/labels';
import type { AccessType, HoursWindow, Report, Restroom, StallType, Tri } from '../domain/types';
import { newId } from '../domain/validate';
import { useApp } from '../state/AppState';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AdminPage() {
  const { provider, mode, setMode, demoAdmin, setDemoAdmin, env } = useApp();
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [password, setPassword] = useState('');
  const [serverAuthed, setServerAuthed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Restroom | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([provider.listRestrooms(), provider.listReports()])
      .then(([nextRestrooms, nextReports]) => {
        if (cancel) return;
        setRestrooms(nextRestrooms);
        setReports(nextReports);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancel) return;
        setMessage(error instanceof Error ? error.message : 'Could not load admin data.');
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [provider, version]);

  useEffect(() => {
    if (mode !== 'server') return;
    let cancel = false;
    fetch(`${env.apiBase}/api/admin/me`, { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { authenticated?: boolean }) => {
        if (!cancel) setServerAuthed(Boolean(body.authenticated));
      })
      .catch(() => {
        if (!cancel) setServerAuthed(false);
      });
    return () => {
      cancel = true;
    };
  }, [mode, env.apiBase, version]);

  const authorized = mode === 'server' ? serverAuthed : demoAdmin;

  async function login() {
    const response = await fetch(`${env.apiBase}/api/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setServerAuthed(false);
      setMessage(body.error ?? 'Sign-in failed.');
      return;
    }
    setPassword('');
    setServerAuthed(true);
    setMessage('Signed in to the local admin API.');
  }

  async function logout() {
    await fetch(`${env.apiBase}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    setServerAuthed(false);
  }

  async function moderate(id: string, status: 'approved' | 'rejected') {
    try {
      await provider.moderate(id, status);
      setMessage(status === 'approved' ? 'Report approved. Verified fields were not overwritten.' : 'Report rejected.');
      setVersion((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Moderation was not saved.');
    }
  }

  async function save() {
    if (!draft) return;
    setFormError(null);
    try {
      await provider.saveRestroom({ ...draft, updatedAt: new Date().toISOString() });
      setMessage('Saved in the sandbox. Packaged seed data was not rewritten.');
      setVersion((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The restroom was not saved.');
    }
  }

  async function reset() {
    if (!window.confirm('Reset sandbox edits, reports, and ratings? Packaged sample places will return.')) return;
    try {
      await provider.reset();
      setDraft(null);
      setMessage('Sandbox reset. Packaged sample places are unchanged.');
      setVersion((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reset failed.');
    }
  }

  return (
    <Shell title="Admin">
      <div className="stack">
        <h1>Admin</h1>
        <p>
          {mode === 'demo'
            ? 'Demo admin edits stay in this browser. They are not shared, and this toggle is not server authentication. Run the local API to require a real admin password.'
            : 'Server sandbox. Admin changes require a password checked by the local API. The packaged seed file is not rewritten.'}
        </p>
        <fieldset className="stack-tight">
          <legend>Data location</legend>
          <label>
            <input type="radio" name="data-mode" checked={mode === 'demo'} onChange={() => setMode('demo')} /> This device
          </label>
          <label>
            <input type="radio" name="data-mode" checked={mode === 'server'} onChange={() => setMode('server')} /> Local server sandbox
          </label>
        </fieldset>

        {mode === 'demo' ? (
          <button type="button" className="btn btn-secondary" data-testid="admin-toggle" onClick={() => setDemoAdmin(!demoAdmin)}>
            {demoAdmin ? 'Lock demo admin' : 'Open demo admin on this device'}
          </button>
        ) : serverAuthed ? (
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>Sign out</button>
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label className="field">
              Admin password
              <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-secondary">Sign in</button>
          </form>
        )}
        {message ? <p role="status">{message}</p> : null}
        {loading ? <p>Loading sandbox…</p> : null}

        {authorized ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void reset()}>Reset demo data</button>
            <section className="stack">
              <h2>Reports and suggestions</h2>
              {reports.length === 0 ? <p>No reports.</p> : null}
              {reports.map((report) => (
                <article key={report.id} className="card stack-tight">
                  <p>
                    {report.sample ? 'Sample report. ' : ''}
                    {REPORT_LABEL[report.kind]} — {report.status}
                  </p>
                  <p>{report.note}</p>
                  {report.suggestion ? (
                    <p>
                      Suggested place: {report.suggestion.name}, {report.suggestion.address}. Approving this does not
                      create a restroom.
                    </p>
                  ) : null}
                  <div className="btn-row">
                    <button type="button" className="btn btn-secondary" onClick={() => void moderate(report.id, 'approved')}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void moderate(report.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <section className="stack">
              <h2>Restrooms</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setDraft(blankRestroom(mode))}>
                Add a restroom
              </button>
              {restrooms.map((restroom) => (
                <button key={restroom.id} type="button" className="btn btn-ghost" onClick={() => setDraft(structuredClone(restroom))}>
                  Edit {restroom.name}
                </button>
              ))}
              {draft ? (
                <RestroomForm
                  draft={draft}
                  error={formError}
                  onChange={setDraft}
                  onSave={() => void save()}
                />
              ) : null}
            </section>

            <section className="stack">
              <h2>QR codes</h2>
              <p>Codes point at this site’s entrance pages. Generating a code does not publish a real participating business.</p>
              {restrooms
                .flatMap((restroom) => restroom.entrances.map((entrance) => ({ restroom, entrance })))
                .map(({ restroom, entrance }) => (
                  <article key={entrance.id} className="card">
                    <h3>{restroom.name}</h3>
                    <QrImage path={`q/${entrance.slug}`} label={`${entrance.name} at ${restroom.name}`} />
                  </article>
                ))}
            </section>
          </>
        ) : (
          <p>Admin tools stay hidden until you open demo admin or sign in to the API.</p>
        )}
      </div>
    </Shell>
  );
}

function blankRestroom(mode: 'demo' | 'server'): Restroom {
  const city = PILOT_CITIES[0];
  return {
    id: newId('custom'),
    cityId: city.id,
    name: '',
    address: '',
    location: { ...city.center },
    access: 'unknown',
    hours: null,
    timeZone: city.timeZone,
    wheelchair: 'unknown',
    stallType: 'unknown',
    changingTable: 'unknown',
    familyRestroom: 'unknown',
    genderNeutral: 'unknown',
    parkingDelayMin: null,
    entranceDelayMin: null,
    indoorWalkMin: null,
    entranceSummary: null,
    indoorSummary: null,
    entrances: [],
    sampleRating: null,
    verifiedAt: null,
    verificationSource: null,
    verificationHistory: [],
    dataset: mode === 'server' ? 'server-sandbox' : 'device-sandbox',
    fictional: true,
    allowExternalNavigation: false,
    updatedAt: new Date().toISOString(),
  };
}

function RestroomForm({
  draft,
  error,
  onChange,
  onSave,
}: {
  draft: Restroom;
  error: string | null;
  onChange: (next: Restroom) => void;
  onSave: () => void;
}) {
  function patch(partial: Partial<Restroom>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <form
      className="card stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h3>Edit restroom</h3>
      <label className="field">Name<input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label className="field">Address<input value={draft.address} onChange={(event) => patch({ address: event.target.value })} /></label>
      <label className="field">
        City
        <select
          value={draft.cityId}
          onChange={(event) => {
            const city = cityById(event.target.value);
            patch({
              cityId: event.target.value,
              location: city ? { ...city.center } : draft.location,
              timeZone: city?.timeZone ?? draft.timeZone,
            });
          }}
        >
          {PILOT_CITIES.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </label>
      <label className="field">Latitude<input type="number" step="0.0001" value={draft.location.lat} onChange={(event) => patch({ location: { ...draft.location, lat: Number(event.target.value) } })} /></label>
      <label className="field">Longitude<input type="number" step="0.0001" value={draft.location.lng} onChange={(event) => patch({ location: { ...draft.location, lng: Number(event.target.value) } })} /></label>
      <label className="field">
        Access
        <select value={draft.access} onChange={(event) => patch({ access: event.target.value as AccessType })}>
          <option value="public">Public</option>
          <option value="customer-only">Customer-only</option>
          <option value="purchase-required">Purchase required</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <HoursEditor hours={draft.hours} onChange={(hours) => patch({ hours })} />
      <TriField label="Wheelchair accessible" value={draft.wheelchair} onChange={(wheelchair) => patch({ wheelchair })} />
      <label className="field">
        Stalls
        <select value={draft.stallType} onChange={(event) => patch({ stallType: event.target.value as StallType })}>
          <option value="unknown">Unknown</option>
          <option value="single-user">Single-user</option>
          <option value="multi-stall">Multi-stall</option>
        </select>
      </label>
      <TriField label="Changing table" value={draft.changingTable} onChange={(changingTable) => patch({ changingTable })} />
      <TriField label="Family restroom" value={draft.familyRestroom} onChange={(familyRestroom) => patch({ familyRestroom })} />
      <TriField label="Gender-neutral" value={draft.genderNeutral} onChange={(genderNeutral) => patch({ genderNeutral })} />
      <DelayField label="Parking delay minutes" value={draft.parkingDelayMin} onChange={(parkingDelayMin) => patch({ parkingDelayMin })} />
      <DelayField label="Entrance delay minutes" value={draft.entranceDelayMin} onChange={(entranceDelayMin) => patch({ entranceDelayMin })} />
      <DelayField label="Indoor walk minutes" value={draft.indoorWalkMin} onChange={(indoorWalkMin) => patch({ indoorWalkMin })} />
      <label className="field">Entrance summary<textarea value={draft.entranceSummary ?? ''} onChange={(event) => patch({ entranceSummary: event.target.value || null })} /></label>
      <label className="field">Indoor summary<textarea value={draft.indoorSummary ?? ''} onChange={(event) => patch({ indoorSummary: event.target.value || null })} /></label>
      <EntrancesEditor entrances={draft.entrances} onChange={(entrances) => patch({ entrances })} />
      <label className="field">
        Verification source
        <input value={draft.verificationSource ?? ''} onChange={(event) => patch({ verificationSource: event.target.value || null })} />
      </label>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          const at = new Date().toISOString();
          const source = draft.verificationSource?.trim() || 'Demo admin';
          patch({
            verifiedAt: at,
            verificationSource: source,
            verificationHistory: [...draft.verificationHistory, { at, source, note: 'Marked reviewed in the demo admin.' }],
          });
        }}
      >
        Mark reviewed now
      </button>
      <p className="note">Reviewed {draft.verifiedAt ?? 'unknown'}.</p>
      <label>
        <input
          type="checkbox"
          checked={draft.fictional}
          onChange={(event) => patch({ fictional: event.target.checked, allowExternalNavigation: event.target.checked ? false : draft.allowExternalNavigation })}
        />{' '}
        Fictional demo place
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.allowExternalNavigation}
          disabled={draft.fictional}
          onChange={(event) => patch({ allowExternalNavigation: event.target.checked })}
        />{' '}
        I confirm this pin is a real restroom I am willing to navigate to
      </label>
      {error ? <p className="banner banner-bad" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-secondary">Save restroom</button>
    </form>
  );
}

function TriField({ label, value, onChange }: { label: string; value: Tri; onChange: (value: Tri) => void }) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as Tri)}>
        <option value="unknown">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

function DelayField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        min={0}
        max={180}
        value={value ?? ''}
        placeholder="Unknown"
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    </label>
  );
}

function HoursEditor({ hours, onChange }: { hours: HoursWindow[] | null; onChange: (hours: HoursWindow[] | null) => void }) {
  const mode = hours == null ? 'unknown' : hours.length === 0 ? 'closed' : 'scheduled';
  return (
    <fieldset className="stack">
      <legend>Hours</legend>
      <select
        value={mode}
        onChange={(event) => {
          if (event.target.value === 'unknown') onChange(null);
          else if (event.target.value === 'closed') onChange([]);
          else onChange(hours && hours.length > 0 ? hours : [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '18:00' }]);
        }}
      >
        <option value="unknown">Unknown</option>
        <option value="closed">No open hours</option>
        <option value="scheduled">Scheduled</option>
      </select>
      {mode === 'scheduled' && hours
        ? hours.map((window, index) => (
            <div key={`${index}-${window.open}`} className="stack-tight">
              <div className="seg">
                {DAYS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={window.days.includes(day)}
                    onClick={() => {
                      const days = window.days.includes(day)
                        ? window.days.filter((item) => item !== day)
                        : [...window.days, day].sort((a, b) => a - b);
                      const next = hours.slice();
                      next[index] = { ...window, days };
                      onChange(next);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="field">Opens<input value={window.open} onChange={(event) => {
                const next = hours.slice();
                next[index] = { ...window, open: event.target.value };
                onChange(next);
              }} /></label>
              <label className="field">Closes<input value={window.close} onChange={(event) => {
                const next = hours.slice();
                next[index] = { ...window, close: event.target.value };
                onChange(next);
              }} /></label>
              <button type="button" className="btn btn-ghost" onClick={() => onChange(hours.filter((_, item) => item !== index))}>
                Remove window
              </button>
            </div>
          ))
        : null}
      {mode === 'scheduled' ? (
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...(hours ?? []), { days: [1, 2, 3, 4, 5], open: '08:00', close: '18:00' }])}>
          Add hours window
        </button>
      ) : null}
    </fieldset>
  );
}

function EntrancesEditor({
  entrances,
  onChange,
}: {
  entrances: Restroom['entrances'];
  onChange: (entrances: Restroom['entrances']) => void;
}) {
  return (
    <fieldset className="stack">
      <legend>Entrances and QR starting points</legend>
      {entrances.map((entrance, index) => (
        <div key={entrance.id} className="stack-tight">
          <label className="field">Name<input value={entrance.name} onChange={(event) => {
            const next = entrances.slice();
            next[index] = { ...entrance, name: event.target.value };
            onChange(next);
          }} /></label>
          <label className="field">Slug<input value={entrance.slug} onChange={(event) => {
            const next = entrances.slice();
            next[index] = { ...entrance, slug: event.target.value };
            onChange(next);
          }} /></label>
          <label className="field">Directions<textarea value={entrance.directions} onChange={(event) => {
            const next = entrances.slice();
            next[index] = { ...entrance, directions: event.target.value };
            onChange(next);
          }} /></label>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          const id = newId('door');
          onChange([...entrances, { id, name: 'New entrance', slug: id, directions: 'Describe the walk from this sign to the restroom.' }]);
        }}
      >
        Add entrance
      </button>
    </fieldset>
  );
}
