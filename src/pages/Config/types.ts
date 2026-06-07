// The config UI consumes an *annotated node tree* produced by the server's
// reflection walk over the effective config. Containers carry children/items;
// leaves carry a typed value (or a redacted display for secret/url). All of this
// is what the Go side will emit later — the sample mirrors it exactly.

export type NodeKind =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'bool'
  | 'null'
  | 'secret'
  | 'url'

export interface FieldDoc {
  description?: string
  type?: string // Go type label (display only), e.g. "Duration", "[]string", "TLSConfig", "PEMData"
  default?: unknown
  env?: string // corresponding environment variable name
}

export interface ConfigNode {
  key: string
  kind: NodeKind
  // Leaf payloads:
  value?: unknown // string | number | boolean | null — for plain leaves
  display?: string | null // for secret/url: masked / structured display
  set?: boolean // for secret/url: presence (distinguishes empty from filled)
  human?: string // optional human-friendly rendering, kept separate from raw value
  // Containers:
  children?: ConfigNode[] // object
  items?: ConfigNode[] // array
  // Metadata:
  overridden?: boolean // value differs from its default (server diffs against a defaults-only load)
  doc?: FieldDoc
}

export interface ConfigMeta {
  centrifugo_version?: string
  edition?: string
  loaded_at?: string // ISO timestamp
  config_hash?: string
}

export interface ConfigResponse {
  meta?: ConfigMeta
  warnings?: string[] // unknown keys + startup warnings
  fields: ConfigNode[]
}
