import { createContext, PropsWithChildren, useContext } from 'react'

// Permissions the server grants in admin/session (PRO). Write controls
// are wrapped in <Can permission="...">; roles are never checked here, so a
// new role needs no UI change.
// They follow Centrifugo's objects - channels, clients, push - plus ops for
// operating Centrifugo itself (config, analytics, snapshots, compression).
export type Permission =
  | 'ops:read'
  | 'ops:write'
  | 'channels:read'
  | 'channels:write'
  | 'clients:read'
  | 'clients:write'
  | 'push:read'
  | 'push:write'

// Session is what the server says about the logged-in admin, loaded before
// pages render. null means no restrictions: OSS, an older PRO server without
// admin/session, or a failed request - the server enforces access anyway.
export interface Session {
  user: { name: string; auth: string; role: string }
  permissions: Permission[]
}

export const SessionContext = createContext<Session | null>(null)

export const useSession = (): Session | null => useContext(SessionContext)

// hasPermission is useCan for code outside a component's top level, e.g.
// filtering a list.
export const hasPermission = (
  session: Session | null,
  permission: Permission
): boolean => !session || session.permissions.includes(permission)

export const useCan = (permission: Permission): boolean =>
  hasPermission(useSession(), permission)

// Can renders its children only when the user has the permission.
export const Can = ({
  permission,
  children,
}: PropsWithChildren<{ permission: Permission }>) =>
  useCan(permission) ? <>{children}</> : null
