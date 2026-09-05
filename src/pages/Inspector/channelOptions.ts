// Channel-options model + resolver.
//
// The admin config endpoint returns an *annotated node tree*; `reconstructConfig`
// turns it back into a plain object, and `resolveChannel` mirrors Centrifugo's own
// resolution (see internal/config/container.go `ChannelOptions`): strip the private
// prefix, split the channel on the namespace boundary, match the prefix against a
// configured namespace, and fall back to `channel.without_namespace` when the
// channel carries no namespace prefix.
//
// Keeping this pure and typed makes the Channel inspector's rendering a simple
// function of the resolved options — easy to extend as Centrifugo grows new options.

import { ConfigNode } from 'pages/Config/types'

export type SubscriptionType =
  'stream' | 'map' | 'map_clients' | 'map_users' | 'shared_poll'

// A permissive view of a namespace's effective channel options. Only the fields the
// inspector reads are typed; unknown/new fields still pass through via the index
// signature so nothing breaks when the server adds options.
export interface ChannelOptions {
  // Core
  presence?: boolean
  join_leave?: boolean
  force_push_join_leave?: boolean
  history_size?: number
  history_ttl?: string
  history_meta_ttl?: string
  force_positioning?: boolean
  allow_positioning?: boolean
  force_recovery?: boolean
  allow_recovery?: boolean
  force_recovery_mode?: string // "stream" | "cache"
  auto_cache_recover?: boolean
  delta_publish?: boolean
  allowed_delta_types?: string[]
  allow_tags_filter?: boolean
  channel_regex?: string
  publication_data_format?: string
  allow_user_limited_channels?: boolean

  // Subscription mechanism
  subscription_type?: SubscriptionType | string
  map?: Record<string, unknown>
  shared_poll?: Record<string, unknown>

  // Client-side permission matrix (allow_<op>_for_<who>)
  allow_subscribe_for_client?: boolean
  allow_subscribe_for_anonymous?: boolean
  allow_publish_for_client?: boolean
  allow_publish_for_subscriber?: boolean
  allow_publish_for_anonymous?: boolean
  allow_presence_for_client?: boolean
  allow_presence_for_subscriber?: boolean
  allow_presence_for_anonymous?: boolean
  allow_history_for_client?: boolean
  allow_history_for_subscriber?: boolean
  allow_history_for_anonymous?: boolean

  // Proxies (event routing)
  subscribe_proxy_enabled?: boolean
  subscribe_proxy_name?: string
  publish_proxy_enabled?: boolean
  publish_proxy_name?: string
  sub_refresh_proxy_enabled?: boolean
  sub_refresh_proxy_name?: string
  subscribe_stream_proxy_enabled?: boolean
  subscribe_stream_proxy_name?: string
  subscribe_stream_proxy_bidirectional?: boolean
  cache_empty_proxy_enabled?: boolean
  cache_empty_proxy_name?: string
  state_proxy_enabled?: boolean

  // PRO authorization (CEL)
  subscribe_cel?: string
  publish_cel?: string
  presence_cel?: string
  history_cel?: string

  // PRO publication processing / delivery
  schemas?: string[]
  exclude_client_info?: boolean
  keep_latest_publication?: boolean
  shared_position_sync?: boolean
  broker_name?: string
  presence_manager_name?: string
  batch_max_size?: number
  batch_max_delay?: string
  batch_flush_latest?: boolean
  allow_channel_compaction?: boolean

  [key: string]: unknown
}

export interface ResolvedChannel {
  channel: string
  // Namespace name, or null when the channel has no namespace prefix (uses
  // `without_namespace`). `known` is false when a prefix is present but no matching
  // namespace is configured — Centrifugo would reject such a channel.
  namespace: string | null
  known: boolean
  options: ChannelOptions
}

// ---- config reconstruction from the annotated node tree --------------------

function nodeToValue(n: ConfigNode): unknown {
  switch (n.kind) {
    case 'object': {
      const obj: Record<string, unknown> = {}
      for (const c of n.children ?? []) obj[c.key] = nodeToValue(c)
      return obj
    }
    case 'array':
      return (n.items ?? []).map(nodeToValue)
    case 'secret':
    case 'url':
      // Secrets/urls are redacted in the tree; the inspector never needs their raw
      // value, only presence. Surface a sentinel so callers can detect "is set".
      return n.set ? (n.display ?? '<set>') : null
    default:
      return n.value ?? null
  }
}

// Turn the server's annotated config node tree back into a plain config object.
export function reconstructConfig(
  fields: ConfigNode[] | undefined
): Record<string, any> {
  const root: Record<string, unknown> = {}
  for (const n of fields ?? []) root[n.key] = nodeToValue(n)
  return root
}

// ---- resolution ------------------------------------------------------------

// Read a string config field, falling back to the server's own default when the
// field is absent (older server, or a config endpoint that doesn't expose it). An
// explicitly empty value is kept: an empty boundary disables namespaces, and an
// empty private prefix disables the private-channel marker.
const strOption = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback

// The part of the channel a namespace's `channel_regex` is matched against —
// everything after the first namespace boundary, or the whole channel when there
// is none. Mirrors the `rest` the server derives in Container.ChannelOptions; the
// private prefix sits before the boundary, so it never leaks into the rest.
export const channelRest = (channel: string, boundary: string): string => {
  const at = boundary ? channel.indexOf(boundary) : -1
  return at === -1 ? channel : channel.slice(at + boundary.length)
}

export function resolveChannel(
  channel: string,
  cfg: Record<string, any>
): ResolvedChannel {
  const chCfg = (cfg?.channel ?? {}) as Record<string, any>
  const boundary = strOption(chCfg.namespace_boundary, ':')
  const privatePrefix = strOption(chCfg.private_prefix, '$')
  const namespaces: Array<Record<string, any>> = Array.isArray(chCfg.namespaces)
    ? chCfg.namespaces
    : []
  const withoutNs: ChannelOptions = (chCfg.without_namespace ??
    {}) as ChannelOptions

  // The server strips the private prefix before looking for the boundary, so
  // `$news:index` lives in the `news` namespace like `news:index` does.
  const trimmed =
    privatePrefix && channel.startsWith(privatePrefix)
      ? channel.slice(privatePrefix.length)
      : channel
  const idx = boundary ? trimmed.indexOf(boundary) : -1
  // No boundary, or an empty namespace part (`:index`), means without_namespace —
  // the server looks options up by namespace name, and "" is the default one.
  const nsName = idx === -1 ? '' : trimmed.slice(0, idx)
  if (!nsName) {
    return { channel, namespace: null, known: true, options: withoutNs }
  }
  const ns = namespaces.find(n => n?.name === nsName)
  if (!ns) {
    return { channel, namespace: nsName, known: false, options: {} }
  }
  return {
    channel,
    namespace: nsName,
    known: true,
    options: ns as ChannelOptions,
  }
}

// ---- derived helpers used across the Channel inspector ---------------------

export const subscriptionType = (o: ChannelOptions): SubscriptionType =>
  (o.subscription_type as SubscriptionType) || 'stream'

export const isMapType = (o: ChannelOptions): boolean =>
  subscriptionType(o).startsWith('map')

// A linear-history channel (stream or shared_poll) — one publication log addressed
// by offset, as opposed to keyed map types which surface through the map panel. The
// history API and panel are identical for stream and shared_poll; only map differs.
export const isLinearHistory = (o: ChannelOptions): boolean =>
  hasHistory(o) && !isMapType(o)

// History is available when a positive history_size is configured (stream types).
export const hasHistory = (o: ChannelOptions): boolean =>
  typeof o.history_size === 'number' && o.history_size > 0

export const hasPresence = (o: ChannelOptions): boolean => !!o.presence

// Cache/latest-only recovery changes what "history" means to a subscriber.
export const isCacheRecovery = (o: ChannelOptions): boolean =>
  o.force_recovery_mode === 'cache' || !!o.keep_latest_publication

export const isStreamProxied = (o: ChannelOptions): boolean =>
  !!o.subscribe_stream_proxy_enabled
