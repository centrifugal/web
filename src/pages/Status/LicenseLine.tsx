import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { useAdminApi } from 'api/adminApi'

import {
  formatLicenseDate,
  licenseDateHint,
  licenseDates,
  licenseLimits,
  LicenseSeverity,
  LicenseStatus,
} from './license'

const chipColor = (s: LicenseSeverity) =>
  s === 'error' ? 'error' : s === 'warning' ? 'warning' : 'default'

// LicenseLine is one compact line with the license of the node serving the
// admin UI (PRO). It renders nothing when the server has no license endpoint
// (older servers) or the request fails - the status page must not depend on it.
export const LicenseLine = ({ authorization }: { authorization: string }) => {
  const { rawRequest } = useAdminApi({ authorization })
  const [status, setStatus] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    rawRequest('admin/api/license')
      .then(async res => {
        if (!res.ok) return
        const st = (await res.json()) as LicenseStatus
        if (!cancelled) setStatus(st)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [rawRequest])

  if (!status) return null

  const limits = licenseLimits(status)
  return (
    <Box
      data-testid="license-line"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1,
        rowGap: 0.5,
        // Sits in the gap below the summary cards, so the page layout is the
        // same whether the line is shown or not.
        mt: -2,
        mb: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        License:
      </Typography>
      {status.sandbox ? (
        <Tooltip title="No license key configured. Centrifugo PRO runs with sandbox limits.">
          <Typography variant="body2">Sandbox mode ({limits})</Typography>
        </Tooltip>
      ) : (
        <>
          <Tooltip title={`Limits: ${limits}`}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {status.owner}
              {status.trial ? ' (trial)' : ''}
            </Typography>
          </Tooltip>
          {licenseDates(status).map(d => (
            <Tooltip
              key={d.kind}
              title={`${licenseDateHint(d)} ${new Date(d.at * 1000).toISOString()}`}
            >
              <Chip
                size="small"
                variant={d.severity === 'ok' ? 'outlined' : 'filled'}
                color={chipColor(d.severity)}
                label={`${d.label} ${formatLicenseDate(d.at)}`}
              />
            </Tooltip>
          ))}
          {licenseDates(status).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              no expiration
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}
