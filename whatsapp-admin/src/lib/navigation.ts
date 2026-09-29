/**
 * Lightweight programmatic navigation that plugs into the app's
 * pushState-based tab router (no react-router in this codebase).
 *
 * App.tsx listens for `popstate`, so dispatching it after pushState
 * makes the sidebar switch to the target tab immediately.
 */
export function navigateTo(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Read a query param from the current URL (e.g. /inbox?wa_id=12345).
 */
export function getQueryParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}
