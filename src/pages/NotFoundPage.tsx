import { Link } from 'react-router-dom';
import { Shell } from '../components/Shell';

export function NotFoundPage() {
  return (
    <Shell title="Not found">
      <h1>Page not found</h1>
      <p>That address is not part of this prototype.</p>
      <Link className="btn btn-secondary" to="/">Back home</Link>
    </Shell>
  );
}
