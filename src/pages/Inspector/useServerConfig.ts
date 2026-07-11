// Fetches the server config once (via the admin config endpoint), reconstructs it
// into a plain object, and derives the capability/durability facts the Inspector
// needs. Lifted to the Inspector page so both tabs share a single fetch.

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAdminApi } from 'api/adminApi'
import { ConfigResponse } from 'pages/Config/types'

import {
  reconstructConfig,
  resolveChannel,
  ResolvedChannel,
} from './channelOptions'

export type Durability = 'memory' | 'redis' | 'database' | 'unknown'

export interface ServerConfig {
  loading: boolean
  error: string | null
  // Reconstructed plain config (null until loaded).
  cfg: Record<string, any> | null
  resolve: (channel: string) => ResolvedChannel | null
  // Derived User-tab facts.
  userStatusEnabled: boolean
  blockDurability: Durability
  revokeDurability: Durability
  invalidateDurability: Durability
  // Push device browsing requires push + a database (device storage).
  pushDevicesSupported: boolean
  // ClickHouse analytics enabled → link to historical explorer pages.
  analyticsEnabled: boolean
  // Namespaces (for autocomplete / hints).
  namespaces: string[]
  namespaceBoundary: string
}

const asDurability = (v: unknown): Durability => {
  if (v === 'memory' || v === 'redis' || v === 'database') return v
  return v == null ? 'memory' : 'unknown' // memory is the server default
}

export const useServerConfig = (authorization: string): ServerConfig => {
  const { rawRequest } = useAdminApi({ authorization })
  const [cfg, setCfg] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await rawRequest('admin/api/config')
        if (!res.ok) throw new Error(`status ${res.status}`)
        const json = (await res.json()) as {
          config?: ConfigResponse
        } & ConfigResponse
        const resp = json.config ?? json
        if (!cancelled) setCfg(reconstructConfig(resp.fields))
      } catch {
        if (!cancelled)
          setError('Failed to load server configuration for the inspector.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [rawRequest])

  const resolve = useCallback(
    (channel: string) => (cfg ? resolveChannel(channel, cfg) : null),
    [cfg]
  )

  return useMemo<ServerConfig>(() => {
    const channel = (cfg?.channel ?? {}) as Record<string, any>
    const namespaces: string[] = Array.isArray(channel.namespaces)
      ? channel.namespaces.map((n: any) => n?.name).filter(Boolean)
      : []
    return {
      loading,
      error,
      cfg,
      resolve,
      userStatusEnabled: !!cfg?.user_status?.enabled,
      blockDurability: asDurability(cfg?.user_block?.storage_type),
      revokeDurability: asDurability(cfg?.token_revoke?.storage_type),
      invalidateDurability: asDurability(
        cfg?.user_tokens_invalidate?.storage_type
      ),
      pushDevicesSupported:
        !!cfg?.push_notifications?.enabled && !!cfg?.database?.enabled,
      analyticsEnabled: !!cfg?.clickhouse_analytics?.enabled,
      namespaces,
      namespaceBoundary: channel.namespace_boundary || ':',
    }
  }, [cfg, loading, error, resolve])
}
