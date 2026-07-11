import { useEffect, useRef, useState } from 'react'

import { InspectorApi } from './types'
import { ChannelOptions, ResolvedChannel } from './channelOptions'
import { ServerConfig } from './useServerConfig'

interface Resolution {
  loading: boolean
  resolved: ResolvedChannel | null
  error: string | null
}

// Resolves a channel's effective options via the admin `channel_options` endpoint,
// which uses Centrifugo's own resolution — including PRO channel patterns. Falls
// back to client-side namespace resolution if the endpoint is unavailable (e.g. an
// older server), so the tab still works everywhere.
export const useChannelResolution = (
  channel: string,
  api: InspectorApi,
  server: ServerConfig
): Resolution => {
  const [state, setState] = useState<Resolution>({
    loading: false,
    resolved: null,
    error: null,
  })

  // Keep the config-backed fallback resolver in a ref so a config load (which
  // changes `server`) doesn't re-trigger resolution and flash a spinner.
  const resolveRef = useRef(server.resolve)
  resolveRef.current = server.resolve

  useEffect(() => {
    if (!channel) {
      setState({ loading: false, resolved: null, error: null })
      return
    }
    let cancelled = false
    setState({ loading: true, resolved: null, error: null })

    api
      .adminGet<{ namespace: string; found: boolean; options: ChannelOptions }>(
        `admin/api/channel_options?channel=${encodeURIComponent(channel)}`
      )
      .then(resp => {
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          resolved: {
            channel,
            namespace: resp.namespace || null,
            known: resp.found,
            options: resp.options || {},
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        // Fallback: resolve client-side from the loaded config. If config is also
        // unavailable, still show a minimal resolution so actions/trace work.
        const fallback = resolveRef.current(channel) ?? {
          channel,
          namespace: null,
          known: true,
          options: {},
        }
        setState({ loading: false, resolved: fallback, error: null })
      })

    return () => {
      cancelled = true
    }
  }, [channel, api])

  return state
}
