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
import { roleLabel, useSession } from 'contexts/SessionContext'

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
  // What these bytes were compressed against. A profile can hold several rows
  // at once — connections outside a staged rollout are on the structure tier,
  // and a version just replaced keeps its own row until the connections
  // holding it reconnect.
  tier: string
  dictionary_id: string
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
  // What this dictionary's version measured at approval; zero with
  // expected_measured false when there is no version or it was not measured.
  expected_ratio: number
  expected_measured: boolean
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
  // False when the session ended before its control window: approved_ratio
  // is then a projection that flatters, not an expectation.
  ratio_measured: boolean
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
  // False when the session ended before its control window: approved_ratio
  // is then a projection that flatters, not an expectation.
  ratio_measured: boolean
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
  // Frames kept aside in the session's last quarter to measure what is built;
  // every other count here is the training set.
  held_back_frames: number
  // When the training set last gained a message shape; null before the first.
  last_new_shape_at: string | null
  // Values refused before collection, by reason.
  denied: Record<string, number> | null
  ratio_by_protocol: Record<string, number> | null
  size_curve: SizeCurvePoint[] | null
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

// A review's three answers. A value in none of them is not reviewed: it does
// not ship and is not remembered, so the next review asks about it again.
// The server may send null for an empty list.
export interface ReviewSelection {
  approved: string[] | null
  denied: string[] | null
  // Fields denied whole: every value under the path, in this and later
  // sessions.
  denied_fields: string[] | null
}

// What earlier reviews of the profile decided about a candidate's values.
export interface PriorDecisions {
  allowed?: string[]
  denied?: string[]
  denied_fields?: string[]
}

export interface Candidate {
  // How many answers a saved draft holds, allowed and denied together.
  draft_count: number
  // The saved draft. It wins over the recommendation and prior_decisions.
  draft?: ReviewSelection
  // Earlier reviews of the session's profile: what was allowed arrives
  // ticked, what was denied arrives denied, so a retrain asks only about
  // what is new. Denied values are never recommended.
  prior_decisions?: PriorDecisions
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
  // The value ranking, cut at the longest selection any rung was measured
  // with. A rung's recommended_values indexes into it, so choosing a different
  // size can apply the selection measured there.
  ranked_hashes?: string[]
  // The rung of the size ladder the measurements favour, and the size
  // recommended_count was measured at. Zero when nothing was measured.
  recommended_size: number
  id: string
  fidelity: string
  ratio_by_protocol: Record<string, number>
  size_curve: SizeCurvePoint[]
  values_total: number
  expires_at: string
  // Building mints a new set rather than replacing the last, so a session
  // accumulates near-identical candidates. They arrive newest first; this is
  // what lets the list say which one is current.
  created_at: string
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
  // True when this profile's operator denied the value, or its whole field, in
  // an earlier review. Shown marked rather than filtered out, so a denial made
  // by mistake stays visible and reversible.
  previously_denied: boolean
  // True when an earlier review of this profile allowed it.
  previously_approved: boolean
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
  // Only these ship. Values in no list are not reviewed: not shipped, not
  // remembered.
  approved: string[]
  denied: string[]
  denied_fields: string[]
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

// A value a version ships, from GET /versions/{id}/values.
export interface VersionValue {
  path: string
  value: string
  value_hash: string
  occurrences: number
  witnesses: number
}

// The profile was made client_declarable or default after this version was
// approved: serving it again approves it for the wider audience, so the
// request has to be resent with confirm_audience.
export const AUDIENCE_WIDENED = 'audience_widened'

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
    selection: ReviewSelection
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
  // Versions
  listVersions: (profileId: string) => Promise<{ versions: Version[] }>
  // confirmAudience approves the version for a wider audience than it was
  // approved for; without it the server refuses with AUDIENCE_WIDENED.
  activateVersion: (
    versionId: string,
    rolloutPercent: number,
    confirmAudience?: boolean
  ) => Promise<Version>
  deactivateVersion: (versionId: string) => Promise<Version>
  rollbackProfile: (
    profileId: string,
    confirmAudience?: boolean
  ) => Promise<Version>
  listVersionValues: (versionId: string) => Promise<{ values: VersionValue[] }>
  // Withdraws values from an approved version: rebuilt without them as a new
  // version, which replaces the old one if it was active.
  denyVersionValues: (
    versionId: string,
    req: { denied: string[]; denied_fields: string[] }
  ) => Promise<Version>

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
  const session = useSession()

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
        if (response.status === 403) {
          code = 'forbidden'
          message = session
            ? `Permission denied for role ${roleLabel(session)}`
            : 'Permission denied'
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
    [rawRequest, session]
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
      draftCandidate: (candidateId, selection) =>
        postJson<Candidate>(`/candidates/${candidateId}/draft`, selection),
      previewCandidate: (candidateId, reqBody) =>
        postJson<CandidatePreview>(
          `/candidates/${candidateId}/preview`,
          reqBody
        ),
      approveCandidate: (candidateId, reqBody) =>
        postJson<Version>(`/candidates/${candidateId}/approve`, reqBody),
      assignSession: (sessionId, reqBody) =>
        postJson<Version>(`/sessions/${sessionId}/assign`, reqBody),
      listVersions: profileId =>
        getJson<{ versions: Version[] }>(`/profiles/${profileId}/versions`),
      activateVersion: (versionId, rolloutPercent, confirmAudience) =>
        postJson<Version>(`/versions/${versionId}/activate`, {
          rollout_percent: rolloutPercent,
          confirm_audience: !!confirmAudience,
        }),
      deactivateVersion: versionId =>
        postJson<Version>(`/versions/${versionId}/deactivate`),
      rollbackProfile: (profileId, confirmAudience) =>
        postJson<Version>(
          `/profiles/${profileId}/rollback`,
          confirmAudience ? { confirm_audience: true } : undefined
        ),
      listVersionValues: versionId =>
        getJson<{ values: VersionValue[] }>(`/versions/${versionId}/values`),
      denyVersionValues: (versionId, reqBody) =>
        postJson<Version>(`/versions/${versionId}/deny`, reqBody),

      handleError: handleCompressionError,
    }),
    [getJson, postJson, patchJson, del, handleCompressionError]
  )
}
