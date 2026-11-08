export function absoluteAppUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const root = new URL(base, window.location.origin);
  return new URL(path.replace(/^\//, ''), root).toString();
}
