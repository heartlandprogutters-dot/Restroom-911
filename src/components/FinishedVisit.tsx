import { useState } from 'react';

/** Shown only after the tester ends a visit. Not targeted and not a real ad. */
export function FinishedVisit() {
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <div className="stack">
      <button
        type="button"
        className="btn btn-ghost"
        data-testid="finished-visit"
        onClick={() => {
          setDone(true);
          setVisible(true);
        }}
      >
        Finished visit
      </button>
      {done && visible ? (
        <aside className="sponsor" data-testid="sponsor-demo" role="note">
          <p>
            <strong>Demonstration offer.</strong> This is not a real advertisement. It is not chosen from your
            health, urgency, or location.
          </p>
          <p>A dismissible note like this could appear only after someone ends a visit.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setVisible(false)}>
            Dismiss
          </button>
        </aside>
      ) : null}
    </div>
  );
}
