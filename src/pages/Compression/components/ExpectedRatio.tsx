import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { ApprovedRatio } from '../api'
import { fmtRatio } from '../format'

export const NOT_MEASURED_HINT =
  'This dictionary came from a training session stopped before its last quarter, which is held back to measure the result, so nothing measured it. Overview shows what it actually saves.'

interface ExpectedRatioProps {
  ratio: ApprovedRatio | undefined
  measured: boolean
}

// ExpectedRatio: what a version was measured to save when it was approved.
// A ratio scored without a control window is the dictionary judged on its own
// source, several times too high, so it is not shown as an expectation.
export const ExpectedRatio = ({ ratio, measured }: ExpectedRatioProps) => {
  if (!measured) {
    return (
      <Tooltip title={NOT_MEASURED_HINT} arrow>
        <Typography variant="body2" component="span" color="text.secondary">
          not measured
        </Typography>
      </Tooltip>
    )
  }
  const parts: string[] = []
  if (ratio?.json != null) parts.push(`json ${fmtRatio(ratio.json)}`)
  if (ratio?.protobuf != null)
    parts.push(`protobuf ${fmtRatio(ratio.protobuf)}`)
  return <>{parts.length ? parts.join(' · ') : '—'}</>
}
