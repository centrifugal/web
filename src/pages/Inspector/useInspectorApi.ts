import { useContext, useMemo } from 'react'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

import { ApiError, InspectorApi } from './types'

// Wraps useAdminApi + ShellContext into the compact InspectorApi that panels use.
// `call` unwraps the server-API {result|error} envelope so panels can `try/catch`
// and read a typed result directly.
export const useInspectorApi = (
  authorization: string,
  signinSilent: () => void
): InspectorApi => {
  const { command, rawRequest } = useAdminApi({ authorization, signinSilent })
  const { showAlert } = useContext(ShellContext)

  return useMemo<InspectorApi>(
    () => ({
      call: async <T = any>(method: string, params?: unknown): Promise<T> => {
        const resp: any = await command(method, params)
        if (resp?.error) {
          const err = new Error(
            resp.error.message || 'Request failed'
          ) as Error & { apiError: ApiError }
          err.apiError = resp.error
          throw err
        }
        return resp?.result as T
      },
      adminGet: async <T = any>(path: string): Promise<T> => {
        const res = await rawRequest(path)
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json() as Promise<T>
      },
      showAlert,
    }),
    [command, rawRequest, showAlert]
  )
}
