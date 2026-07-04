import { useCallback, useContext } from 'react'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'

// Build a URL for an admin endpoint path under the current handler prefix.
// `globalUrlPrefix` is window.location.pathname, which is stable under the
// HashRouter, so this resolves correctly regardless of Centrifugo's
// configured admin handler_prefix.
export const adminUrl = (path: string): string => `${globalUrlPrefix}${path}`

// Error thrown by adminFetch for any non-2xx response, carrying the HTTP
// status so callers (or the shared handler) can branch on 401/403/etc.
export class AdminApiError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `HTTP error ${status}`)
    this.name = 'AdminApiError'
    this.status = status
  }
}

export interface AdminFetchOptions extends RequestInit {
  // Value for the Authorization header. Empty/undefined (e.g. server-side OIDC
  // cookie mode) sends no header and relies on same-origin credentials.
  authorization?: string
}

// Lowest-level admin request: attaches the auth header + same-origin
// credentials and returns the raw Response WITHOUT throwing on a non-2xx
// status. Use this when the caller needs to branch on specific status codes
// itself (e.g. 404/409); use adminFetch/command/requestJson when a non-2xx
// should throw AdminApiError.
export async function adminRawFetch(
  path: string,
  { authorization, headers, ...init }: AdminFetchOptions = {}
): Promise<Response> {
  const finalHeaders = new Headers(headers)
  if (authorization) {
    finalHeaders.set('Authorization', authorization)
  }
  return fetch(adminUrl(path), {
    credentials: 'same-origin',
    mode: 'same-origin',
    ...init,
    headers: finalHeaders,
  })
}

// Low-level admin request: as adminRawFetch, but throws AdminApiError on a
// non-2xx response. Does not parse the body.
export async function adminFetch(
  path: string,
  options?: AdminFetchOptions
): Promise<Response> {
  const response = await adminRawFetch(path, options)
  if (!response.ok) {
    throw new AdminApiError(response.status)
  }
  return response
}

// Same as adminFetch but parses and returns the JSON body.
export async function adminFetchJson<T = unknown>(
  path: string,
  options?: AdminFetchOptions
): Promise<T> {
  const response = await adminFetch(path, options)
  return (await response.json()) as T
}

export interface UseAdminApiOptions {
  authorization: string
  // Called on a 401 to trigger a silent re-auth (throttled by the caller).
  signinSilent?: () => void
}

export interface AdminApiHook {
  // POST {method, params} to admin/api and return the parsed JSON body
  // (the Centrifugo admin API envelope, e.g. { result }). Throws on non-2xx.
  command: <T = any>(method: string, params?: unknown) => Promise<T>
  // Fetch an arbitrary admin endpoint, returning the raw Response WITHOUT
  // throwing, so the caller can branch on status codes itself.
  rawRequest: (path: string, init?: RequestInit) => Promise<Response>
  // Fetch an arbitrary admin endpoint (REST-style), throwing on non-2xx.
  request: (path: string, init?: RequestInit) => Promise<Response>
  // As request(), but parses and returns the JSON body.
  requestJson: <T = any>(path: string, init?: RequestInit) => Promise<T>
  // Standard error handling: on 401 alert + signinSilent, on 403 alert
  // "Permission denied", otherwise a generic connection alert. Call this from
  // a catch block so every page reacts to auth/errors consistently.
  handleError: (error: unknown) => void
}

// React hook that binds the admin API to the current authorization and the
// Shell's alert surface, centralizing URL building, headers, and the 401/403
// handling that was previously copy-pasted across every page.
export function useAdminApi({
  authorization,
  signinSilent,
}: UseAdminApiOptions): AdminApiHook {
  const { showAlert } = useContext(ShellContext)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AdminApiError) {
        if (error.status === 401) {
          showAlert('Unauthorized', { severity: 'error' })
          signinSilent?.()
          return
        }
        if (error.status === 403) {
          showAlert('Permission denied', { severity: 'error' })
          return
        }
      }
      showAlert('Error connecting to server', { severity: 'error' })
    },
    [showAlert, signinSilent]
  )

  const rawRequest = useCallback(
    (path: string, init?: RequestInit) =>
      adminRawFetch(path, { authorization, ...init }),
    [authorization]
  )

  const request = useCallback(
    (path: string, init?: RequestInit) =>
      adminFetch(path, { authorization, ...init }),
    [authorization]
  )

  const requestJson = useCallback(
    async <T = any>(path: string, init?: RequestInit): Promise<T> => {
      const response = await request(path, init)
      return (await response.json()) as T
    },
    [request]
  )

  const command = useCallback(
    <T = any>(method: string, params: unknown = {}): Promise<T> =>
      requestJson<T>('admin/api', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ method, params }),
      }),
    [requestJson]
  )

  return { command, rawRequest, request, requestJson, handleError }
}
