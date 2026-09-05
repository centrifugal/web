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
// which uses Centrifugo's own resolution — including PRO channel patterns and the
// server's verdict on the channel name. Falls back to client-side namespace
// resolution if the endpoint is unavailable (e.g. an older server), so the tab
// still works everywhere; what comes back from that path is marked unverified.
//
// `name_valid` and `pattern` are newer than the endpoint itself, so a server that
// predates them simply omits them and `nameValid` stays undefined — the header then
// renders no verdict instead of computing one here.
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
      .adminGet<{
        namespace: string
        found: boolean
        options: ChannelOptions
        name_valid?: boolean
        pattern?: boolean
      }>(`admin/api/channel_options?channel=${encodeURIComponent(channel)}`)
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
            verified: true,
            nameValid: resp.name_valid,
            pattern: resp.pattern,
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
          verified: false,
        }
        setState({ loading: false, resolved: fallback, error: null })
      })

    return () => {
      cancelled = true
    }
  }, [channel, api])

  return state
}
