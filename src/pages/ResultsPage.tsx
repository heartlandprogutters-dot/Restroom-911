import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RestroomCard } from '../components/RestroomCard';
import { Shell } from '../components/Shell';
import { brand } from '../config/brand';
import { exclusionLabel, RANKING_WEIGHTS, rankRestrooms, type TravelFact } from '../domain/ranking';
import type { RankMode } from '../domain/types';
import { useDataset } from '../lib/useDataset';
import { useApp } from '../state/AppState';
import { loadSearch, saveSearch, type ActiveSearch } from '../state/search';

const ResultsMap = lazy(() => import('../components/ResultsMap').then((module) => ({ default: module.ResultsMap })));

const PREF_LABEL: Record<string, string> = {
  wheelchair: 'wheelchair accessible',
  singleUser: 'single-user or family restroom',
  changingTable: 'changing table',
  genderNeutral: 'gender-neutral restroom',
};

export function ResultsPage() {
  const { plan, setPlan, routing, mode, setMode, online, packagedOn } = useApp();
  const { restrooms, reports, ratings, loading, error } = useDataset();
  const [search, setSearch] = useState<ActiveSearch | null>(() => loadSearch());
  const [routed, setRouted] = useState<Record<string, TravelFact> | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const [routingBusy, setRoutingBusy] = useState(false);

  const ranked = useMemo(() => {
    if (!search) return null;
    const pool = search.origin.cityId
      ? restrooms.filter((restroom) => restroom.cityId === search.origin.cityId)
      : restrooms;
    return rankRestrooms({
      restrooms: pool,
      origin: { lat: search.origin.lat, lng: search.origin.lng },
      now: new Date(),
      preferences: search.preferences,
      mode: search.mode,
      reports,
      ratings,
      travel: routed ?? undefined,
      maxDistanceMeters: search.origin.cityId ? null : RANKING_WEIGHTS.searchRadiusMeters,
    });
  }, [search, restrooms, reports, ratings, routed]);

  function chooseMode(nextMode: RankMode) {
    if (!search) return;
    const next = { ...search, mode: nextMode };
    saveSearch(next);
    setSearch(next);
  }

  async function requestRoutes() {
    if (!search || routing.id !== 'osrm') return;
    setRoutingBusy(true);
    const pool = search.origin.cityId
      ? restrooms.filter((restroom) => restroom.cityId === search.origin.cityId)
      : restrooms;
    const result = await routing.estimate(
      { lat: search.origin.lat, lng: search.origin.lng },
      pool.map((restroom) => ({ id: restroom.id, location: restroom.location })),
    );
    setRouted(result.byId);
    setRouteNote(result.fallbackReason);
    setRoutingBusy(false);
  }

  if (plan === 'free') {
    return (
      <Shell title="Results">
        <section className="stack dialog" data-testid="plan-gate">
          <h1>Location search is the paid plan</h1>
          <p>
            The planned price is ${brand.plannedMonthlyPriceUsd} per month. This prototype does not collect payment
            or card numbers. Free access includes QR indoor directions.
          </p>
          <button type="button" className="btn btn-secondary" data-testid="plan-continue" onClick={() => setPlan('paid-simulated')}>
            Simulate paid access
          </button>
          <Link className="btn btn-ghost" to="/qr">Use a QR code instead</Link>
        </section>
      </Shell>
    );
  }

  const required = search
    ? Object.entries(search.preferences)
        .filter(([, level]) => level === 'required')
        .map(([key]) => PREF_LABEL[key])
    : [];
  const mapPoints = ranked?.best
    ? [ranked.best, ...ranked.alternatives].map((item) => ({
        id: item.restroom.id,
        name: item.restroom.name,
        location: item.restroom.location,
      }))
    : [];
  const nearbyExcluded = ranked?.excluded.filter((item) => !item.reasons.includes('too-far')) ?? [];

  return (
    <Shell title="Results">
      <div className="stack">
        <p className="banner" role="note">{brand.demoWarning}</p>
        {!online ? (
          <p className="banner">
            Offline. Showing demo data packaged on {packagedOn}. Hours and distances are not live.
          </p>
        ) : null}
        {!search ? (
          <>
            <h1>No search yet</h1>
            <p>Choose a pilot city or use your location on the home screen.</p>
            <Link className="btn btn-secondary" to="/">Back to search</Link>
          </>
        ) : (
          <>
            <h1>Suitable restrooms</h1>
            <p>{search.origin.label}</p>
            {search.origin.accuracyMeters != null ? (
              <p>Location accuracy about {Math.round(search.origin.accuracyMeters).toLocaleString('en-US')} meters.</p>
            ) : null}
            {required.length > 0 ? <p>Required: {required.join(', ')}. Unknown is not treated as a match.</p> : null}
            <div className="seg" role="radiogroup" aria-label="Sort results">
              <button type="button" role="radio" aria-checked={search.mode === 'fastest'} data-testid="mode-fastest" onClick={() => chooseMode('fastest')}>
                Fastest suitable
              </button>
              <button type="button" role="radio" aria-checked={search.mode === 'highest-rated'} data-testid="mode-highest" onClick={() => chooseMode('highest-rated')}>
                Highest rated
              </button>
            </div>
            <p className="note">
              {routing.id === 'osrm'
                ? `Travel time is optional. Asking for it sends this search location and the restroom coordinates to ${routing.endpoint}.`
                : 'Distances are straight-line approximations. Travel time is not shown.'}
            </p>
            {routing.id === 'osrm' ? (
              <button type="button" className="btn btn-ghost" disabled={routingBusy} onClick={() => void requestRoutes()}>
                {routingBusy ? 'Asking the routing server…' : 'Get travel time estimates'}
              </button>
            ) : null}
            {routeNote ? <p role="status">{routeNote}</p> : null}
            {loading ? <p role="status">Looking for suitable restrooms…</p> : null}
            {error ? (
              <div className="banner banner-bad" role="alert">
                <p>{error}</p>
                {mode === 'server' ? (
                  <button type="button" className="btn btn-secondary" onClick={() => setMode('demo')}>
                    Use demo data on this device
                  </button>
                ) : null}
              </div>
            ) : null}
            {!loading && !error && ranked?.emptyReason ? (
              <p className="banner" role="status" data-testid="results-empty">{ranked.emptyReason}</p>
            ) : null}
            {ranked?.best ? (
              <>
                <h2>Best suitable option</h2>
                <RestroomCard ranked={ranked.best} featured />
              </>
            ) : null}
            {ranked && ranked.alternatives.length > 0 ? (
              <>
                <h2>Other options</h2>
                {ranked.alternatives.map((item) => (
                  <RestroomCard key={item.restroom.id} ranked={item} />
                ))}
              </>
            ) : null}
            {ranked?.best && ranked.alternatives.length === 0 ? <p>No other suitable options in this demo set.</p> : null}
            {nearbyExcluded.length > 0 ? (
              <section>
                <h2>Not suitable right now</h2>
                <ul data-testid="excluded-list">
                  {nearbyExcluded.slice(0, 8).map((item) => (
                    <li key={item.restroom.id}>
                      {item.restroom.name}: {item.reasons.map(exclusionLabel).join(' ')}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <p className="note">Hours describe the listed schedule only. They do not mean a restroom is vacant or available.</p>
            <h2>Map</h2>
            <p className="note">
              Map tiles come from OpenStreetMap. The tile server sees your IP address and the map area. The list does
              not depend on the map, and we do not send coordinates to analytics.
            </p>
            {search ? (
              <Suspense fallback={<p>Loading map…</p>}>
                <ResultsMap
                  origin={{ lat: search.origin.lat, lng: search.origin.lng }}
                  originLabel={search.origin.kind === 'geolocation' ? 'Search spot' : 'Demo search spot'}
                  points={mapPoints}
                />
              </Suspense>
            ) : null}
          </>
        )}
      </div>
    </Shell>
  );
}
