import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { useAdminApi } from 'api/adminApi'

import {
  formatLicenseDateTime,
  licenseTextColor,
  licenseDateText,
  LicenseStatus,
} from './license'

// useLicense loads the license of the node serving the admin UI (PRO). The
// status page starts it alongside its first info request and renders once
// both are done, so the line doesn't pop in and push the cards down.
// status stays null when the server has no license endpoint (older servers)
// or the request fails - the status page must not depend on it.
export const useLicense = (authorization: string, enabled: boolean) => {
  const { rawRequest } = useAdminApi({ authorization })
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [settled, setSettled] = useState(!enabled)

  useEffect(() => {
    if (!enabled) {
      setSettled(true)
      return
    }
    let cancelled = false
    setSettled(false)
    rawRequest('admin/api/license')
      .then(async res => {
        if (!res.ok) return
        const st = (await res.json()) as LicenseStatus
        if (!cancelled) setStatus(st)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSettled(true)
      })
    return () => {
      cancelled = true
    }
  }, [rawRequest, enabled])

  return { status, settled }
}

// LicenseLine is one compact line with the license (see useLicense).
export const LicenseLine = ({ status }: { status: LicenseStatus | null }) => {
  if (!status) return null

  return (
    <Box
      data-testid="license-line"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        // Right-aligned and in caption size so it stays secondary to the cards.
        justifyContent: 'flex-end',
        columnGap: 1,
        rowGap: 0.5,
        // Sits above the summary cards, pulled up into the page padding.
        mt: -2,
        mb: 1.5,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        License:
      </Typography>
      <Tooltip title={status.hint ?? ''}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: status.sandbox ? 400 : 600 }}
        >
          {status.text}
        </Typography>
      </Tooltip>
      {status.dates?.map(d => (
        <React.Fragment key={`${d.label}-${d.at}`}>
          <Typography variant="caption" color="text.secondary">
            ·
          </Typography>
          <Tooltip title={`${d.hint} ${formatLicenseDateTime(d.at)}`}>
            <Typography
              variant="caption"
              sx={{
                color: licenseTextColor(d.severity),
                fontWeight: d.severity === 'ok' ? 400 : 600,
              }}
            >
              {licenseDateText(d)}
            </Typography>
          </Tooltip>
        </React.Fragment>
      ))}
    </Box>
  )
}
