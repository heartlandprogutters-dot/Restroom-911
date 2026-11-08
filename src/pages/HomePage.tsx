import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PreferenceFields } from '../components/PreferenceFields';
import { Shell } from '../components/Shell';
import { brand } from '../config/brand';
import { cityById, matchPilotCity, PILOT_CITIES } from '../data/cities';
import { canUseLocationSearch } from '../domain/accessPlan';
import type { RankMode } from '../domain/types';
import { classifyGeoError, formatAccuracy, requestPosition, type GeoFailure, type GeoFix } from '../lib/geoLocate';
import { useApp } from '../state/AppState';
import { saveSearch, type ActiveSearch } from '../state/search';

type Pending =
  | { type: 'city'; cityId: string; mode: RankMode }
  | { type: 'geo'; mode: RankMode }
  | { type: 'manual'; query: string; mode: RankMode };

const GEO_COPY: Record<GeoFailure, string> = {
  denied: 'Location permission was denied. You can pick a pilot city instead. We will not keep asking on our own.',
  unavailable: 'Location is unavailable on this device right now. Pick a pilot city to continue.',
  timeout: 'Location took too long. Pick a pilot city, or try again.',
};

export function HomePage() {
  const { plan, setPlan, preferences, setPreference } = useApp();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<GeoFailure | null>(null);
  const [low, setLow] = useState<{ fix: GeoFix; mode: RankMode } | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const gateRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (pending) gateRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  function go(search: ActiveSearch) {
    saveSearch(search);
    navigate('/results');
  }

  function searchCity(cityId: string, mode: RankMode, kind: 'demo-city' | 'manual-city', query?: string) {
    const city = cityById(cityId);
    if (!city) return;
    go({
      origin: {
        kind,
        lat: city.center.lat,
        lng: city.center.lng,
        accuracyMeters: null,
        cityId: city.id,
        label:
          kind === 'manual-city'
            ? `${city.name} city center, matched from “${query ?? city.name}”. Not your GPS.`
            : `${city.name}, Kentucky city center (demo). Not your GPS.`,
      },
      mode,
      preferences,
      startedAt: new Date().toISOString(),
    });
  }

  async function locate(mode: RankMode) {
    setGeoError(null);
    setLow(null);
    setLocating(true);
    try {
      const fix = await requestPosition();
      if (fix.accuracyMeters != null && fix.accuracyMeters > 500) {
        setLow({ fix, mode });
        return;
      }
      go({
        origin: {
          kind: 'geolocation',
          lat: fix.lat,
          lng: fix.lng,
          accuracyMeters: fix.accuracyMeters,
          cityId: null,
          label: 'Your location for this search',
        },
        mode,
        preferences,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      setGeoError(classifyGeoError(error));
    } finally {
      setLocating(false);
    }
  }

  function run(action: Pending) {
    if (action.type === 'city') searchCity(action.cityId, action.mode, 'demo-city');
    else if (action.type === 'manual') {
      const city = matchPilotCity(action.query);
      if (!city) {
        setManualError('Demo mode only recognizes the five pilot cities. It does not look up street addresses.');
        return;
      }
      setManualError(null);
      searchCity(city.id, action.mode, 'manual-city', action.query);
    } else {
      void locate(action.mode);
    }
  }

  function begin(action: Pending) {
    if (!canUseLocationSearch(plan)) {
      setPending(action);
      return;
    }
    run(action);
  }

  return (
    <Shell title="Home">
      <div className="stack">
        <p className="note">{brand.tagline}</p>
        <h1>Need a restroom?</h1>
        <fieldset className="stack-tight">
          <legend>Tester access (simulation)</legend>
          <label>
            <input
              type="radio"
              name="plan"
              data-testid="plan-free"
              checked={plan === 'free'}
              onChange={() => setPlan('free')}
            />{' '}
            Free — QR directions only
          </label>
          <label>
            <input
              type="radio"
              name="plan"
              data-testid="plan-paid"
              checked={plan === 'paid-simulated'}
              onChange={() => setPlan('paid-simulated')}
            />{' '}
            Paid — location search, ${brand.plannedMonthlyPriceUsd}/month planned
          </label>
          <p className="note">No payment or card is collected. This switch is only for testing future gating.</p>
        </fieldset>

        {pending ? (
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="gate-title" data-testid="plan-gate">
            <h2 id="gate-title" tabIndex={-1} ref={gateRef}>Location search is the paid plan</h2>
            <p>
              The planned price is ${brand.plannedMonthlyPriceUsd} per month. This prototype does not collect payment
              or card numbers.
            </p>
            <p>Free access includes QR indoor directions. Location search stays available when you simulate paid access.</p>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="plan-continue"
              onClick={() => {
                const action = pending;
                setPlan('paid-simulated');
                setPending(null);
                run(action);
              }}
            >
              Simulate paid access and continue
            </button>
            <button type="button" className="btn btn-ghost" data-testid="plan-stay" onClick={() => setPending(null)}>
              Stay on the free plan
            </button>
            <Link to="/qr">Try a sample QR code</Link>
          </section>
        ) : null}

        <button
          type="button"
          className="btn btn-urgent"
          data-testid="restroom-now"
          disabled={locating}
          onClick={() => begin({ type: 'geo', mode: 'fastest' })}
        >
          {locating ? 'Finding your location…' : 'RESTROOM NOW'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="find-rated"
          disabled={locating}
          onClick={() => begin({ type: 'geo', mode: 'highest-rated' })}
        >
          Find a highly rated restroom
        </button>

        <section className="stack" aria-labelledby="where">
          <h2 id="where">Where should we look?</h2>
          <p>
            Your location is used only to sort nearby restrooms for this search. We ask after you tap, and we do not
            keep a location history. This prototype has no analytics.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="use-location"
            disabled={locating}
            onClick={() => begin({ type: 'geo', mode: 'fastest' })}
          >
            Use my location
          </button>
          {geoError ? (
            <p className="banner banner-bad" role="alert" data-testid="geo-error">{GEO_COPY[geoError]}</p>
          ) : null}
          {low?.fix.accuracyMeters != null ? (
            <div className="banner" role="status" data-testid="low-accuracy">
              <p>
                This fix is only accurate to about {formatAccuracy(low.fix.accuracyMeters)}. You can search anyway or
                pick a pilot city.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="search-anyway"
                onClick={() =>
                  go({
                    origin: {
                      kind: 'geolocation',
                      lat: low.fix.lat,
                      lng: low.fix.lng,
                      accuracyMeters: low.fix.accuracyMeters,
                      cityId: null,
                      label: 'Your approximate location for this search',
                    },
                    mode: low.mode,
                    preferences,
                    startedAt: new Date().toISOString(),
                  })
                }
              >
                Search anyway
              </button>
            </div>
          ) : null}
          <p>Or test a pilot city. This uses the city center, not your GPS.</p>
          <div className="btn-row">
            {PILOT_CITIES.map((city) => (
              <button
                key={city.id}
                type="button"
                className="btn btn-ghost"
                data-testid={`city-${city.id}`}
                onClick={() => begin({ type: 'city', cityId: city.id, mode: 'fastest' })}
              >
                {city.name}
              </button>
            ))}
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              begin({ type: 'manual', query: manual, mode: 'fastest' });
            }}
          >
            <label className="field">
              Or type a pilot city
              <input
                data-testid="manual-query"
                value={manual}
                maxLength={120}
                autoComplete="off"
                onChange={(event) => setManual(event.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-ghost" data-testid="manual-search">
              Search this place
            </button>
            {manualError ? <p role="alert">{manualError}</p> : null}
          </form>
        </section>

        <section className="stack" aria-labelledby="access-prefs">
          <h2 id="access-prefs">Accessibility</h2>
          <p>Preferred is a bonus. Required removes places that do not confirm that feature. Unknown stays unknown.</p>
          <PreferenceFields value={preferences} onChange={setPreference} />
        </section>
      </div>
    </Shell>
  );
}
