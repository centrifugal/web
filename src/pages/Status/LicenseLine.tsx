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
        // Sits in the gap below the summary cards, so the page layout is the
        // same whether the line is shown or not.
        mt: -2,
        mb: 2,
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
