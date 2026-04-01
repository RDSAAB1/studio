/**
 * Electron-aware navigation - use current origin when already on http(s) to avoid
 * SecurityError: replaceState cannot use a URL from a different origin.
 */
const ELECTRON_APP_URL = 'http://localhost:3000';

/** Detect Electron: preload exposes .electron, or we set __ELECTRON__ from ?electron=1 (when preload fails in packaged app) */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).__ELECTRON__ === true || typeof (window as any).electron !== 'undefined';
}

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return ELECTRON_APP_URL;
  // Use current origin when already on http(s) so router.replaceState/pushState stay same-origin
  const origin = window.location.origin;
  if (origin.startsWith('http://') || origin.startsWith('https://')) return origin;
  // If the renderer ever lands on file://, force http base so chunks/assets resolve correctly.
  if (origin.startsWith('file://')) return ELECTRON_APP_URL;
  if (isElectron()) return (window as any).electron?.appUrl ?? ELECTRON_APP_URL;
  return origin;
}

/** Alias for getAppBaseUrl - used by app-layout */
export const getElectronBaseUrl = getAppBaseUrl;

/** Navigate to path - prefers client-side (router) to avoid full refresh; full URL only when no router */
export function navigateTo(path: string, router?: { push?: (p: string) => void; replace?: (p: string) => void }): void {
  if (typeof window === 'undefined') return;
  const fullPath = path.startsWith('/') ? path : '/' + path;
  if (router?.push) {
    router.push(fullPath);
    return;
  }
  if (router?.replace) {
    router.replace(fullPath);
    return;
  }
  const base = isElectron() ? getAppBaseUrl() : window.location.origin;
  window.location.href = base + fullPath;
}

type RouterLike = { push?: (p: string) => void; replace?: (p: string) => void };

/** Electron-aware navigation - use router (client-side) when available to avoid full app refresh */
export function electronNavigate(
  path: string,
  router?: RouterLike,
  options?: { method?: 'push' | 'replace' }
): void {
  if (typeof window === 'undefined') return;
  const fullPath = path.startsWith('/') ? path : '/' + path;
  const method = options?.method ?? 'replace';
  if (router) {
    if (method === 'replace' && router.replace) router.replace(fullPath);
    else if (router.push) router.push(fullPath);
    return;
  }
  const base = isElectron() ? getAppBaseUrl() : window.location.origin;
  window.location.href = base + fullPath;
}
