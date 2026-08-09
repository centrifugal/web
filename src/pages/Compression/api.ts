// Typed client for the dictionary compression admin API.
//
// One method per endpoint in specs/ADMIN_API_CONTRACT.md (centrifugo-pro-source),
// including endpoints not yet called from any tab — Profiles/Sessions/review UI
// land in later work and depend on this file, so it defines the full surface up
// front rather than growing it endpoint-by-endpoint.
//
// Wire types are hand-written (no codegen in this repo) and keep snake_case field
// names to match the Go JSON tags exactly.

import { useCallback, useContext, useMemo } from 'react'

import { useAdminApi, UseAdminApiOptions } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

const BASE = 'admin/api/dictionary'

// ---- Error shape ------------------------------------------------------------
// Non-2xx bodies are `{"error": "<machine_code>", "message": "<human sentence>"}`.
// Codes: not_found, conflict, invalid_request, disabled, internal. The UI shows
// `message` and branches only on `code` (never on the raw HTTP status, since e.g.
// 404 covers both "feature disabled" and "no such id").
export class CompressionApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'CompressionApiError'
    this.status = status
    this.code = code
  }
}

// ---- Wire types ---------------------------------------------------------

export interface ConnectionsByTier {
  none: number
  structure: number
  default_profile: number
  own_profile: number
}

export interface ProfileServing {
  profile: string
  protocol: string
  cold_connects: number
  warm_connects: number
  bytes_in: number
  bytes_out: number
  delivery_bytes: number
  frame_compressions: number
  frame_cache_hits: number
  realized_ratio: number
  // bytes_in - bytes_out - delivery_bytes. The headline number: never report
  // gross savings, since a dictionary re-delivered on every reconnect can cost
  // more than it saves and only this figure shows it.
  net_saved_bytes: number
}

export interface ServingSurvey {
  nodes_reporting: number
  // The cluster as it stands. Every figure in this survey is summed over
  // whichever nodes replied, so a shortfall here means an undercount, not a
  // quiet zero.
  nodes_expected: number
  connections_by_tier: ConnectionsByTier
  by_profile: ProfileServing[]
}

export interface CompressionOverview {
  enabled: boolean // the deployment switch, independent of config
  structure_active: boolean
  profiles: number
  active_versions: number
  serving?: ServingSurvey // absent if no node answered
}

export interface StructureInfo {
  active: boolean
  // The deployment-wide switch. This tier's own flag does not decide whether
  // anything is served: with serving off nothing is, whatever this says.
  serving_enabled: boolean
  artifact_id: string
  size_bytes: number
  wire_size: number
  protocol: string
  note: string
}

export interface ApprovedRatio {
  json?: number
  protobuf?: number
}

export interface ActiveVersionSummary {
  id: string
  fidelity: string
  activated_at: string
  rollout_percent: number
  approved_ratio: ApprovedRatio
}

export interface Profile {
  id: string
  name: string
  notes: string
  client_declarable: boolean
  serve_as_default: boolean
  training_mode: string
  revision: number
  active_version: ActiveVersionSummary | null
  connections?: number // live, from survey; omitted when unavailable
  created_at: string
  updated_at: string
}

export interface ProfilesResponse {
  profiles: Profile[]
}

export interface CreateProfileRequest {
  name: string
  notes: string
  client_declarable: boolean
  serve_as_default: boolean
}

export interface Version {
  id: string
  fidelity: string
  artifact_json_id: string
  artifact_protobuf_id: string
  artifact_json_size: number
  artifact_json_wire_size: number
  approved_under: { client_declarable: boolean; serve_as_default: boolean }
  approved_ratio: ApprovedRatio
  approved_by: string
  approved_at: string
  activated_at: string | null
  rollout_percent: number
  active: boolean
  source_session_id: string
  values_count: number
}

export interface ProfileDetail extends Profile {
  versions: Version[]
}

export type ProfilePatch = Partial<{
  notes: string
  client_declarable: boolean
  serve_as_default: boolean
  revision: number
}>

// Turning on client_declarable or serve_as_default widens the audience of a
// dictionary approved for a narrower one, so the server deactivates the active
// version and reports which one via invalidated_version_id.
export interface UpdateProfileResponse extends Profile {
  invalidated_version_id?: string
}

export interface UnclaimedEntry {
  name: string
  connections: number
  distinct_users: number
  // true: profile exists but is not client_declarable (a config answer, not a
  // typo). false: no profile by this name exists at all.
  permitted: boolean
}

export interface UnclaimedResponse {
  entries: UnclaimedEntry[]
}

// The same filter object the Inspector builds, plus profile/unclassified.
// `unclassified` is mutually exclusive with `profile`.
export interface TrainingFilter {
  user?: string
  anonymous?: boolean
  channel?: string
  profile?: string
  unclassified?: boolean
  label_filter?: Record<string, unknown>
}

export type TrainingMode = 'schema' | 'values'

export interface CreateSessionRequest {
  filter: TrainingFilter
  training_mode: TrainingMode
  duration_seconds: number
  // The profile this session trains FOR - distinct from filter.profile, which
  // chooses which connections to sample. Supplying it is what lets review skip
  // values already rejected for that profile.
  profile_id?: string
}

export type SessionStatus = 'running' | 'collected' | 'failed'

export interface SizeCurvePoint {
  size_bytes: number
  ratio: number
  // What delivering this dictionary costs a connection: deflated, and base64
  // on top of that for JSON. Named for what the server sends - it was declared
  // as wire_size here and rendered as such, so the Wire column showed nothing
  // at all while a whole row of plausible numbers sat beside it.
  delivery_bytes: number
  cpu_per_compression_ns: number
  // Frames of savings needed to earn delivery_bytes back.
  payback_frames: number
  // true when ratio was measured against the session's held-out control
  // window rather than projected from the dictionary's own contents. A
  // projection is systematically optimistic - never present the two alike.
  measured: boolean
  // For reviewed candidates: how many values the search approved at THIS size.
  // The selection is searched per size, so it differs down the ladder.
  recommended_values: number
  // How much of the vocabulary this size actually held. A size that held a
  // fraction reports the same ratio shape as one that held everything, so
  // without these a small rung looks indistinguishable from a good one.
  shapes_held: number
  shapes_total: number
  values_held: number
  values_total: number
}

export interface SessionProgress {
  frames_observed: number
  bytes_observed: number
  connections_sampled: number
  connections_matched: number
  effective_cap: number
  distinct_users: number
  distinct_shapes: number
  distinct_keys: number
  distinct_values: number
  by_protocol: Record<string, number>
  by_frame_type: Record<string, number>
  channel_frames: Record<string, number>
  unparseable_by_channel: Record<string, number>
  payload_parse_rate: number
  // Null until measured, never an empty array standing in for it: an
  // unmeasured ratio rendered as zero reads as "measured, and terrible". The
  // server sends null deliberately, so anything consuming these must handle it
  // rather than mapping straight over them.
  new_shapes_over_time: { at: string; count: number }[] | null
  ratio_by_protocol: Record<string, number> | null
  size_curve: SizeCurvePoint[] | null
  holdout_leaks: number
  // Distinguishes "scanned and clear" from "never scanned". A zero
  // holdout_leaks means nothing on its own, and presenting it as a passed
  // check would claim assurance nobody has.
  holdout_scanned: boolean
  warmup_complete: boolean
}

export interface Session {
  id: string
  status: SessionStatus
  training_mode: TrainingMode
  filter: TrainingFilter
  started_at: string
  deadline: string
  stopped_at: string | null
  nodes_expected: number
  nodes_reported: number
  error_message: string
  profile_id?: string
  progress?: SessionProgress
}

export interface SessionsListResponse {
  sessions: Session[]
  next_cursor?: string
}

export interface ListSessionsParams {
  status?: SessionStatus
  limit?: number
  cursor?: string
}

export interface Candidate {
  // How many values are already ticked in a saved draft.
  draft_count: number
  // How far down the ranked list the build measured as best, and what that
  // selection achieved against the session's control window - traffic the
  // dictionary was not built from, so a measurement rather than a projection.
  // Zero when the session had no control window.
  recommended_count: number
  recommended_ratio: number
  // The recommendation itself. Seed the selection from this, never from "the
  // first recommended_count rows" — the list is paged, so that only ever ticks
  // what is loaded, and ticks the wrong rows under a search or another sort.
  recommended_hashes?: string[]
  // The rung of the size ladder the measurements favour, and the size
  // recommended_count was measured at. Zero when nothing was measured.
  recommended_size: number
  id: string
  fidelity: string
  ratio_by_protocol: Record<string, number>
  size_curve: SizeCurvePoint[]
  values_total: number
  expires_at: string
  // true means the ratio assumes full approval and will drop as values are
  // rejected — label it, never present it as measured.
  projected_ratio?: boolean
}

export interface PreviewCandidateRequest {
  approved: string[]
  size_bytes: number
}

export interface CandidatePreview {
  size_bytes: number
  // The dictionary itself, and what a cold connect actually pays for it.
  artifact_bytes: number
  delivery_bytes: number
  ratio_by_protocol: Record<string, number>
  measured: boolean
  shapes_held: number
  shapes_total: number
  // Values the artifact had room for, against those approved. Approving a
  // value that does not fit discloses it and buys nothing.
  values_held: number
  values_offered: number
}

export interface BuildCandidatesResponse {
  candidates: Candidate[]
  reason?: string
}

export interface CandidateValue {
  path: string
  value: string
  value_hash: string
  occurrences: number
  witnesses: number
  contribution: number
  decided: boolean | null
  // True when this profile's operator turned the value down in an earlier
  // review. Shown marked rather than filtered out, so a rejection made by
  // mistake stays visible and reversible.
  previously_denied: boolean
  // The build measured this value as worth approving. Recommended rows sort to
  // the top of the list and arrive ticked.
  recommended: boolean
}

export interface DeniedSummary {
  name: number
  shape: number
  channel_name: number
  length: number
  // Values this profile's operator rejected in an earlier review. Only
  // non-zero when the session named a profile to train for.
  prior_decision: number
}

export interface CandidateValuesResponse {
  values: CandidateValue[]
  next_cursor?: string
  total: number
  // Predicted saving of the candidate's whole vocabulary - the denominator for
  // "how much of the benefit have I selected". Always the whole candidate,
  // never the filtered page.
  total_contribution: number
  denied_summary: DeniedSummary
}

export interface GetCandidateValuesParams {
  search?: string
  min_witness?: number
  cursor?: string
  limit?: number
}

export interface ApproveCandidateRequest {
  approved: string[] // approved value_hashes; everything else is rejected
  profile_id: string
  size_bytes: number
  notes?: string
}

export interface AssignSessionRequest {
  profile_id: string
  size_bytes: number
}

export interface ConflictError {
  error: 'conflict'
  current_revision: number
}

export interface ActivateConflictError {
  error: 'conflict'
  // winner's version id, present when losing a race with another activation
  active_version_id: string
}

// ---- Hook -----------------------------------------------------------------

export interface CompressionApiHook {
  // Deployment state
  getCompression: () => Promise<CompressionOverview>
  setCompressionEnabled: (enabled: boolean) => Promise<CompressionOverview>
  getStructure: () => Promise<StructureInfo>
  setStructureActive: (active: boolean) => Promise<StructureInfo>

  // Profiles
  listProfiles: () => Promise<ProfilesResponse>
  createProfile: (req: CreateProfileRequest) => Promise<Profile>
  getProfile: (id: string) => Promise<ProfileDetail>
  updateProfile: (
    id: string,
    patch: ProfilePatch
  ) => Promise<UpdateProfileResponse>
  deleteProfile: (id: string) => Promise<void>
  getUnclaimed: () => Promise<UnclaimedResponse>

  // Training sessions
  createSession: (req: CreateSessionRequest) => Promise<Session>
  listSessions: (params?: ListSessionsParams) => Promise<SessionsListResponse>
  getSession: (id: string) => Promise<Session>
  extendSession: (id: string, extendSeconds: number) => Promise<Session>
  stopSession: (id: string) => Promise<void>

  // Build, candidates, review
  buildCandidates: (sessionId: string) => Promise<BuildCandidatesResponse>
  // Whatever a session has already been built into, without building. Build
  // is not idempotent - it mints a new set every call - so a screen that lost
  // its copy has to read rather than rebuild.
  listCandidates: (sessionId: string) => Promise<BuildCandidatesResponse>
  getCandidateValues: (
    candidateId: string,
    params?: GetCandidateValuesParams
  ) => Promise<CandidateValuesResponse>
  draftCandidate: (
    candidateId: string,
    approved: string[]
  ) => Promise<Candidate>
  // What a specific selection produces at a specific size, measured the way
  // the candidate was. Approves nothing.
  previewCandidate: (
    candidateId: string,
    req: PreviewCandidateRequest
  ) => Promise<CandidatePreview>
  approveCandidate: (
    candidateId: string,
    req: ApproveCandidateRequest
  ) => Promise<Version>
  assignSession: (
    sessionId: string,
    req: AssignSessionRequest
  ) => Promise<Version>
  undoDecision: (decisionId: string) => Promise<void>

  // Versions
  listVersions: (profileId: string) => Promise<{ versions: Version[] }>
  activateVersion: (
    versionId: string,
    rolloutPercent: number
  ) => Promise<Version>
  deactivateVersion: (versionId: string) => Promise<Version>
  rollbackProfile: (profileId: string) => Promise<Version>

  // Standard 401/403/generic handling, same contract as useAdminApi.handleError.
  handleError: (error: unknown) => void
}

// Generic (rather than Record<string, ...>) so a concrete params interface
// like ListSessionsParams can be passed directly — TS does not consider a
// plain interface assignable to a Record type without an explicit index
// signature, even when every property is structurally compatible.
function buildQuery<T extends object>(params?: T): string {
  if (!params) return ''
  const search = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== '') search.set(k, String(v))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function useCompressionApi({
  authorization,
  signinSilent,
}: UseAdminApiOptions): CompressionApiHook {
  const { rawRequest, handleError } = useAdminApi({
    authorization,
    signinSilent,
  })
  const { showAlert } = useContext(ShellContext)

  // Every call goes through here so the {error, message} body (not just the
  // HTTP status) is available to callers that need to branch on `code`
  // (e.g. 409 conflict, or 404 disabled vs 404 not_found).
  const req = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await rawRequest(`${BASE}${path}`, init)
      if (!response.ok) {
        let code = 'internal'
        let message = `HTTP error ${response.status}`
        try {
          const body = await response.json()
          if (body && typeof body === 'object') {
            if (typeof body.error === 'string') code = body.error
            if (typeof body.message === 'string') message = body.message
          }
        } catch {
          // Non-JSON error body — keep the generic message.
        }
        throw new CompressionApiError(response.status, code, message)
      }
      // DELETE / undo endpoints may respond with no body (204, or 200 with an
      // empty body) — treat an unparseable/empty body as `undefined` rather
      // than throwing, since the caller only wants the throw-on-error signal.
      const text = await response.text()
      if (!text) return undefined as T
      try {
        return JSON.parse(text) as T
      } catch {
        return undefined as T
      }
    },
    [rawRequest]
  )

  const getJson = useCallback(
    <T>(path: string) => req<T>(path, { method: 'GET' }),
    [req]
  )
  const postJson = useCallback(
    <T>(path: string, body?: unknown) =>
      req<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    [req]
  )
  const patchJson = useCallback(
    <T>(path: string, body: unknown) =>
      req<T>(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [req]
  )
  const del = useCallback(
    <T>(path: string) => req<T>(path, { method: 'DELETE' }),
    [req]
  )

  const handleCompressionError = useCallback(
    (error: unknown) => {
      if (error instanceof CompressionApiError) {
        if (error.status === 401) {
          showAlert('Unauthorized', { severity: 'error' })
          signinSilent?.()
          return
        }
        if (error.status === 403) {
          showAlert('Permission denied', { severity: 'error' })
          return
        }
        showAlert(error.message, { severity: 'error' })
        return
      }
      handleError(error)
    },
    [handleError, showAlert, signinSilent]
  )

  // Memoized so the hook's return value is referentially stable across
  // re-renders (as long as authorization/signinSilent don't change) —
  // consumers put individual methods in effect dependency arrays for polling,
  // and a fresh object/closure every render would otherwise re-fire those
  // effects continuously.
  return useMemo<CompressionApiHook>(
    () => ({
      getCompression: () => getJson<CompressionOverview>('/compression'),
      setCompressionEnabled: enabled =>
        postJson<CompressionOverview>('/compression', { enabled }),
      getStructure: () => getJson<StructureInfo>('/structure'),
      setStructureActive: active =>
        postJson<StructureInfo>('/structure', { active }),

      listProfiles: () => getJson<ProfilesResponse>('/profiles'),
      createProfile: reqBody => postJson<Profile>('/profiles', reqBody),
      getProfile: id => getJson<ProfileDetail>(`/profiles/${id}`),
      updateProfile: (id, patch) =>
        patchJson<UpdateProfileResponse>(`/profiles/${id}`, patch),
      deleteProfile: id => del<void>(`/profiles/${id}`),
      getUnclaimed: () => getJson<UnclaimedResponse>('/unclaimed'),

      createSession: reqBody => postJson<Session>('/sessions', reqBody),
      listSessions: params =>
        getJson<SessionsListResponse>(`/sessions${buildQuery(params)}`),
      getSession: id => getJson<Session>(`/sessions/${id}`),
      extendSession: (id, extendSeconds) =>
        patchJson<Session>(`/sessions/${id}`, {
          extend_seconds: extendSeconds,
        }),
      stopSession: id => del<void>(`/sessions/${id}`),

      listCandidates: sessionId =>
        getJson<BuildCandidatesResponse>(`/sessions/${sessionId}/candidates`),
      buildCandidates: sessionId =>
        postJson<BuildCandidatesResponse>(`/sessions/${sessionId}/build`),
      getCandidateValues: (candidateId, params) =>
        getJson<CandidateValuesResponse>(
          `/candidates/${candidateId}/values${buildQuery(params)}`
        ),
      draftCandidate: (candidateId, approved) =>
        postJson<Candidate>(`/candidates/${candidateId}/draft`, { approved }),
      previewCandidate: (candidateId, reqBody) =>
        postJson<CandidatePreview>(
          `/candidates/${candidateId}/preview`,
          reqBody
        ),
      approveCandidate: (candidateId, reqBody) =>
        postJson<Version>(`/candidates/${candidateId}/approve`, reqBody),
      assignSession: (sessionId, reqBody) =>
        postJson<Version>(`/sessions/${sessionId}/assign`, reqBody),
      undoDecision: decisionId =>
        postJson<void>(`/decisions/${decisionId}/undo`),

      listVersions: profileId =>
        getJson<{ versions: Version[] }>(`/profiles/${profileId}/versions`),
      activateVersion: (versionId, rolloutPercent) =>
        postJson<Version>(`/versions/${versionId}/activate`, {
          rollout_percent: rolloutPercent,
        }),
      deactivateVersion: versionId =>
        postJson<Version>(`/versions/${versionId}/deactivate`),
      rollbackProfile: profileId =>
        postJson<Version>(`/profiles/${profileId}/rollback`),

      handleError: handleCompressionError,
    }),
    [getJson, postJson, patchJson, del, handleCompressionError]
  )
}
