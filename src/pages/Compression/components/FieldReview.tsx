import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import BlockIcon from '@mui/icons-material/Block'
import UndoIcon from '@mui/icons-material/Undo'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

import { CandidateField } from '../api'
import { fmtInt } from '../format'

interface FieldReviewProps {
  fields: CandidateField[]
  selected: Set<string>
  denied: Set<string>
  deniedFields: Set<string>
  // Only fields holding values no earlier review decided.
  newOnly: boolean
  onAllow: (field: CandidateField, allow: boolean) => void
  onDenyField: (path: string, deny: boolean) => void
  onShowValues: (path: string) => void
}

// A field whose values almost all occurred once is a measurement - prices,
// volumes, timestamps - not vocabulary: each value is unlikely to come again.
const mostlyOneOff = (f: CandidateField) =>
  f.values >= 20 && f.seen_once / f.values >= 0.9

// FieldReview: the review as a decision per field. Ticking a field allows every
// value it has in this candidate - the same as ticking each of them - and
// values later sessions bring are still asked about. A field worth reading
// value by value is one click away.
export const FieldReview = ({
  fields,
  selected,
  denied,
  deniedFields,
  newOnly,
  onAllow,
  onDenyField,
  onShowValues,
}: FieldReviewProps) => {
  const shown = newOnly ? fields.filter(f => f.new > 0) : fields
  if (shown.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        {newOnly
          ? 'Nothing new: every value here was decided in an earlier review.'
          : 'No values were collected.'}
      </Typography>
    )
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox"></TableCell>
            <TableCell>Field</TableCell>
            <TableCell align="right">Values</TableCell>
            <TableCell>Most frequent</TableCell>
            <TableCell align="right">Allowed</TableCell>
            <TableCell></TableCell>
            <TableCell padding="checkbox"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map(f => {
            const fieldDenied = deniedFields.has(f.path)
            const allowable = f.hashes.filter(h => !denied.has(h))
            const allowed = allowable.filter(h => selected.has(h)).length
            const all = allowable.length > 0 && allowed === allowable.length
            return (
              <TableRow
                key={f.path}
                hover
                sx={fieldDenied ? { opacity: 0.6 } : undefined}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={!fieldDenied && all}
                    indeterminate={!fieldDenied && allowed > 0 && !all}
                    disabled={fieldDenied || allowable.length === 0}
                    inputProps={{ 'aria-label': `Allow ${f.path}` }}
                    onChange={() => onAllow(f, !all)}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {f.path}
                  </Typography>
                  {fieldDenied && (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      label="denied"
                      sx={{ ml: 1 }}
                      title="Never shown, and no longer collected."
                    />
                  )}
                  {!fieldDenied && f.new > 0 && f.new < f.values && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${fmtInt(f.new)} new`}
                      sx={{ ml: 1 }}
                      title="Values no earlier review of this profile decided."
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {fmtInt(f.values)}
                  {f.seen_once > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {f.seen_once === f.values
                        ? 'all seen once'
                        : `${fmtInt(f.seen_once)} seen once`}
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  sx={{
                    maxWidth: 340,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {f.examples.join(', ')}
                    {f.values > f.examples.length && ', …'}
                  </Typography>
                  {mostlyOneOff(f) && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      Mostly one-off values — rarely worth allowing
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {fieldDenied
                    ? '—'
                    : `${fmtInt(allowed)} of ${fmtInt(f.values)}`}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    endIcon={<NavigateNextIcon />}
                    onClick={() => onShowValues(f.path)}
                    disabled={fieldDenied}
                  >
                    {f.values === 1 ? '1 value' : `${fmtInt(f.values)} values`}
                  </Button>
                </TableCell>
                <TableCell padding="checkbox">
                  {fieldDenied ? (
                    <Tooltip title="Undo - collect this field again">
                      <IconButton
                        size="small"
                        aria-label={`Undo denying ${f.path}`}
                        onClick={() => onDenyField(f.path, false)}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Deny the field - never shown, no longer collected">
                      <IconButton
                        size="small"
                        aria-label={`Deny ${f.path}`}
                        onClick={() => onDenyField(f.path, true)}
                      >
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// The breadcrumb above one field's values, back to the field table.
export const FieldCrumb = ({
  path,
  onBack,
}: {
  path: string
  onBack: () => void
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
    <Button size="small" variant="text" onClick={onBack}>
      All fields
    </Button>
    <NavigateNextIcon fontSize="small" color="disabled" />
    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
      {path}
    </Typography>
  </Box>
)
