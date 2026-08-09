import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A selected entity id kept in the query string rather than in component state.
 *
 * Drill-downs held in useState look fine until the page is reloaded, at which
 * point you are back at the list with no way to say where you were - and no way
 * to send anyone a link to the thing you are looking at. Keeping the id in the
 * URL fixes both, and makes the browser's Back button mean what the on-screen
 * one means.
 *
 * Entering a selection pushes a history entry, so Back leaves it. Clearing one
 * replaces, so going back and forth does not stack up entries that all render
 * the same list.
 */
export const useUrlSelection = (
  key: string
): [string | null, (id: string | null) => void] => {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(key)

  const set = useCallback(
    (id: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (id === null) next.delete(key)
          else next.set(key, id)
          return next
        },
        { replace: id === null }
      )
    },
    [key, setSearchParams]
  )

  return [value, set]
}
