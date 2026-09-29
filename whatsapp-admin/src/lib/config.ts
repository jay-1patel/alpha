/**
 * Central application configuration.
 *
 * The backend base URL is resolved from a build-time environment variable so
 * the admin panel can be deployed against a non-localhost API. Precedence:
 *
 *   1. Vite:     import.meta.env.VITE_API_BASE
 *   2. Webpack:  process.env.VITE_API_BASE (defined in webpack.config.js)
 *   3. Fallback: http://localhost:9000
 *
 * Any trailing slash is stripped so callers can safely append path segments.
 */
const rawBase: string | undefined =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE)

export const API_BASE: string = (rawBase || '').replace(/\/+$/, '')

/**
 * WebSocket endpoint derived from the configured API base URL.
 * http(s)://host -> ws(s)://host
 */
export function wsUrl(path: string): string {
  return API_BASE.replace(/^http(s)?:\/\//, 'ws$1://') + path
}
