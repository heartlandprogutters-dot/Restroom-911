import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AppProvider } from './state/AppState';

const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const DetailsPage = lazy(() => import('./pages/DetailsPage').then((m) => ({ default: m.DetailsPage })));
const DirectionsPage = lazy(() => import('./pages/DirectionsPage').then((m) => ({ default: m.DirectionsPage })));
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const RatePage = lazy(() => import('./pages/RatePage').then((m) => ({ default: m.RatePage })));
const SuggestPage = lazy(() => import('./pages/SuggestPage').then((m) => ({ default: m.SuggestPage })));
const QrPage = lazy(() => import('./pages/QrPage').then((m) => ({ default: m.QrPage })));
const QrSamplesPage = lazy(() => import('./pages/QrSamplesPage').then((m) => ({ default: m.QrSamplesPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <AppProvider>
      <Suspense fallback={<p className="wrap">Loading…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/r/:id" element={<DetailsPage />} />
        <Route path="/r/:id/directions" element={<DirectionsPage />} />
        <Route path="/r/:id/report" element={<ReportPage />} />
        <Route path="/r/:id/rate" element={<RatePage />} />
        <Route path="/suggest" element={<SuggestPage />} />
        <Route path="/q/:slug" element={<QrPage />} />
        <Route path="/qr" element={<QrSamplesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </AppProvider>
  );
}
