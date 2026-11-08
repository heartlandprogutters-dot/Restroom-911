import { useEffect, useState } from 'react';
import type { Rating, Report, Restroom } from '../domain/types';
import { useApp } from '../state/AppState';

export function useDataset() {
  const { provider } = useApp();
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    Promise.all([provider.listRestrooms(), provider.listReports(), provider.listRatings()])
      .then(([nextRestrooms, nextReports, nextRatings]) => {
        if (cancel) return;
        setRestrooms(nextRestrooms);
        setReports(nextReports);
        setRatings(nextRatings);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancel) return;
        setError(caught instanceof Error ? caught.message : 'Could not load restrooms.');
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [provider]);

  return { restrooms, reports, ratings, loading, error };
}
