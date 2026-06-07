import { useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'

import { ConfigTree } from './ConfigTree'
import { ConfigResponse } from './types'

interface ConfigProps {
  signinSilent: () => void
  authorization: string
}

export const Config = ({ authorization }: ConfigProps) => {
  const { setTitle } = useContext(ShellContext)
  const [data, setData] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle('Configuration')
  }, [setTitle])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${globalUrlPrefix}admin/api/config`, {
          headers: { Authorization: authorization },
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const json = await res.json()
        if (!cancelled) setData(json.config ?? json)
      } catch (e) {
        if (!cancelled) setError('Failed to load configuration.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authorization])

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : data ? (
        <ConfigTree fields={data.fields} />
      ) : null}
    </Box>
  )
}
