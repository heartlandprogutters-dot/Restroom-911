import { useState } from 'react';
import { externalMapLinks } from '../domain/directions';
import type { Restroom } from '../domain/types';

export function MapsLinks({ restroom }: { restroom: Restroom }) {
  const links = externalMapLinks(restroom.location, restroom.name);
  const [open, setOpen] = useState(!restroom.fictional && restroom.allowExternalNavigation);

  if (!open) {
    return (
      <div className="stack" data-testid="maps-confirm">
        <p>
          {restroom.fictional
            ? 'This pin is a fictional demo coordinate, not a confirmed restroom. Do not follow it for a real emergency.'
            : 'External navigation is off until an admin confirms this pin.'}{' '}
          Opening another maps app does not guarantee the fastest route.
        </p>
        <button type="button" className="btn btn-secondary" data-testid="get-directions" onClick={() => setOpen(true)}>
          Get directions
        </button>
      </div>
    );
  }

  return (
    <div className="stack" data-testid="maps-links">
      <p>
        {restroom.fictional
          ? 'Sample coordinate only. Not for emergency navigation.'
          : 'Opens another maps app.'}{' '}
        Restroom 911 does not calculate or guarantee the fastest route.
      </p>
      <a className="btn btn-secondary" data-testid="maps-geo" href={links.geo}>Open in the device maps app</a>
      <a data-testid="maps-google" href={links.google} rel="noopener noreferrer">Google Maps</a>
      <a data-testid="maps-apple" href={links.apple} rel="noopener noreferrer">Apple Maps</a>
    </div>
  );
}
