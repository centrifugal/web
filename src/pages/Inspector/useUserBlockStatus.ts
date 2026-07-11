import { useEffect, useState } from 'react'

import { InspectorApi } from './types'

export interface BlockStatus {
  loading: boolean
  blocked: boolean
  expireAt: number // unix seconds, 0 = no expiration
  supported: boolean // false when the endpoint is unavailable (older server)
}

// Fetches a user's current block state from the admin `user_blocked` endpoint.
// `supported` is false if the endpoint isn't present, so the UI can fall back to
// simply offering both Block and Unblock.
export const useUserBlockStatus = (
  user: string,
  api: InspectorApi,
  refreshKey?: number
): BlockStatus => {
  const [state, setState] = useState<BlockStatus>({
    loading: false,
    blocked: false,
    expireAt: 0,
    supported: true,
  })

  useEffect(() => {
    if (!user) {
      setState({ loading: false, blocked: false, expireAt: 0, supported: true })
      return
    }
    let cancelled = false
    setState(s => ({ ...s, loading: true }))
    api
      .adminGet<{ blocked: boolean; expire_at: number }>(
        `admin/api/user_blocked?user=${encodeURIComponent(user)}`
      )
      .then(resp => {
        if (cancelled) return
        setState({
          loading: false,
          blocked: !!resp.blocked,
          expireAt: resp.expire_at || 0,
          supported: true,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({
          loading: false,
          blocked: false,
          expireAt: 0,
          supported: false,
        })
      })
    return () => {
      cancelled = true
    }
  }, [user, api, refreshKey])

  return state
}
