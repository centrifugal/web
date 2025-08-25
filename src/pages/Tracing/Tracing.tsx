import { useContext, useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import { green, red, blue } from '@mui/material/colors'
import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  a11yDark,
  solarizedLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'

interface TracingProps {
  signinSilent: () => void
  authorization: string
}

export const Tracing = ({ signinSilent, authorization }: TracingProps) => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [filter, setFilter] = useState('')
  const [isValidFilter, setIsValidFilter] = useState(true)
  const streamCancelRef = useRef<(() => void) | null>(null)
  const filterExpressionRef = useRef<string | null>(null)
  const [traceType, setTraceType] = useState('user')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const celJsRef = useRef<any>(null)

  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode
  const location = useLocation()

  // Load CEL-JS dynamically as it's an ESM module
  useEffect(() => {
    import('cel-js').then(module => {
      celJsRef.current = module
    })
  }, [])

  let codeStyle = solarizedLight
  if (colorMode === 'dark') {
    codeStyle = a11yDark
  }

  useEffect(() => {
    setTitle('Centrifugo | Tracing')
  }, [setTitle])

  // Parse URL parameters to pre-fill form
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const clientIdParam = searchParams.get('client_id')
    const channelParam = searchParams.get('channel')

    if (clientIdParam) {
      // Pre-select Client radio and set client_id value
      setTraceType('client')
      setClientId(clientIdParam)
    } else if (channelParam) {
      // Pre-select Channel radio and set channel value
      setTraceType('channel')
      setChannel(channelParam)
    }
  }, [location.search])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (running) {
      setRunning(false)
    }
    setFilter('')
    
    // Clear input fields when switching types
    const newTraceType = (event.target as HTMLInputElement).value
    if (newTraceType !== traceType) {
      setUser('')
      setChannel('')
      setClientId('')
    }
    
    setTraceType(newTraceType)
    
    // Clear URL parameters when user manually changes trace type
    if (window.location.hash.includes('?')) {
      const newHash = window.location.hash.split('?')[0]
      window.history.replaceState({}, '', window.location.pathname + newHash)
    }
  }

  const buttonSx = {
    ...{
      bgcolor: green[500],
      '&:hover': {
        bgcolor: green[700],
      },
    },
  }

  const stopButtonSx = {
    ...{
      ml: 2,
      bgcolor: red[500],
      '&:hover': {
        bgcolor: red[700],
      },
    },
  }

  const downloadButtonSx = {
    ...{
      ml: 2,
      bgcolor: blue[500],
      '&:hover': {
        bgcolor: blue[700],
      },
    },
  }

  const filterSx = {
    ...(!isValidFilter && {
      input: {
        color: red[500],
      },
    }),
  }

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidFilter) {
      showAlert('Invalid filter expression', {
        severity: 'error',
      })
      return
    }
    setRunning(true)
    if (filter) {
      if (!celJsRef.current) {
        showAlert('CEL library not loaded yet, please try again', {
          severity: 'warning',
        })
        setRunning(false)
        return
      }
      try {
        // Parse to validate the expression
        const result = celJsRef.current.parse(filter)
        if (!result.isSuccess) {
          showAlert('Invalid CEL expression: ' + result.error, {
            severity: 'error',
          })
          setRunning(false)
          return
        }
        filterExpressionRef.current = filter
      } catch (error) {
        showAlert('Invalid CEL expression', { severity: 'error' })
        setRunning(false)
        return
      }
    } else {
      filterExpressionRef.current = null
    }
    startStream(traceType, traceType === 'user' ? user : traceType === 'channel' ? channel : clientId)
    setMessages([])
  }

  const handleStopButtonClick = () => {
    setRunning(false)
    stopStream()
  }

  const handleDownloadClick = () => {
    if (messages.length === 0) {
      showAlert('No trace data to download', { severity: 'warning' })
      return
    }

    const ndjsonLines = messages.map(msg =>
      JSON.stringify({
        timestamp: msg.time,
        ...msg.json,
      })
    )

    const dataStr = ndjsonLines.join('\n')
    const dataBlob = new Blob([dataStr], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    const now = new Date().toISOString()
    link.download = `centrifugo-trace-${traceType}-${now}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showAlert(`Downloaded ${messages.length} trace messages`, {
      severity: 'success',
    })
  }

  const stopStream = function () {
    if (streamCancelRef.current) {
      try {
        streamCancelRef.current()
      } catch (error) {
        // Ignore AbortError when manually stopping the stream
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Error stopping stream:', error)
        }
      }
      streamCancelRef.current = null
    }
    setRunning(false)
  }

  const startStream = function (traceType: string, traceEntity: string) {
    const abortController = new AbortController()
    const cancelFunc = () => {
      abortController.abort()
    }
    streamCancelRef.current = cancelFunc
    //@ts-ignore
    const eventTarget = new FetchEventTarget(`${globalUrlPrefix}admin/trace`, {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authorization,
      }),
      mode: 'same-origin',
      signal: abortController.signal,
      body: JSON.stringify({
        type: traceType,
        entity: traceEntity,
      }),
    })

    eventTarget.addEventListener('open', () => {})

    eventTarget.addEventListener('message', (e: any) => {
      if (e.data === null) {
        // PING.
        return
      }
      processStreamData(e.data)
    })

    const handleClose = () => {
      stopStream()
    }

    eventTarget.addEventListener('error', (error: any) => {
      handleClose()
    })

    eventTarget.addEventListener('close', () => {
      handleClose()
    })
  }

  const processStreamData = function (data: any) {
    if (filterExpressionRef.current !== null && celJsRef.current) {
      try {
        const result = celJsRef.current.evaluate(
          filterExpressionRef.current,
          data
        )
        if (!result) {
          return
        }
      } catch (error) {
        // If filter evaluation fails, skip this message
        console.warn('Filter evaluation error:', error)
        return
      }
    }
    setMessages(messages => [
      { json: data, time: new Date().toLocaleTimeString() },
      ...messages.slice(0, 99),
    ])
  }

  return (
    <Box
      component="form"
      onSubmit={handleFormSubmit}
      className="max-w-8xl mx-auto p-8"
    >
      <FormControl>
        <FormLabel>
          {traceType === 'user'
            ? 'Real-time user connections tracing'
            : traceType === 'channel'
            ? 'Real-time channel tracing'
            : 'Real-time individual client tracing'}
        </FormLabel>
        <RadioGroup
          row
          aria-labelledby="row-radio-buttons-group-label"
          name="row-radio-buttons-group"
          value={traceType}
          onChange={handleChange}
        >
          <FormControlLabel value="user" control={<Radio />} label="User" />
          <FormControlLabel
            value="channel"
            control={<Radio />}
            label="Channel"
          />
          <FormControlLabel
            value="client"
            control={<Radio />}
            label="Client"
          />
        </RadioGroup>
      </FormControl>
      {traceType === 'user' ? (
        <TextField
          margin="normal"
          required
          fullWidth
          name="user"
          label="User ID"
          type="text"
          id="text"
          onChange={event => setUser(event.target.value)}
          value={user}
          autoComplete="off"
          disabled={running}
        />
      ) : traceType === 'channel' ? (
        <TextField
          margin="normal"
          required
          fullWidth
          name="channel"
          label="Channel"
          type="text"
          id="text"
          onChange={event => setChannel(event.target.value)}
          value={channel}
          autoComplete="off"
          disabled={running}
        />
      ) : (
        <TextField
          margin="normal"
          required
          fullWidth
          name="clientId"
          label="Client ID"
          type="text"
          id="text"
          onChange={event => setClientId(event.target.value)}
          value={clientId}
          autoComplete="off"
          disabled={running}
        />
      )}
      <TextField
        margin="normal"
        fullWidth
        name="filter"
        label="Filter expression"
        type="text"
        id="text"
        helperText={
          <span>
            Optionally filter tracing messages on the client side using{' '}
            <Link href="https://cel.dev/" target={'_blank'}>
              CEL expressions
            </Link>
            . Example: <code>type == "pub" && pub.data.input == "hello"</code>
          </span>
        }
        onChange={event => {
          setFilter(event.target.value)
          if (event.target.value && celJsRef.current) {
            try {
              const result = celJsRef.current.parse(event.target.value)
              if (!result.isSuccess) {
                setIsValidFilter(false)
                return
              }
            } catch {
              setIsValidFilter(false)
              return
            }
          }
          setIsValidFilter(true)
        }}
        value={filter}
        autoComplete="off"
        disabled={running}
        sx={filterSx}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <Box sx={{ position: 'relative' }}>
          <Button
            type="submit"
            variant="contained"
            sx={buttonSx}
            disabled={running}
          >
            Start
          </Button>
          {running && (
            <CircularProgress
              size={24}
              sx={{
                color: green[500],
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Box>
        {running && (
          <Button
            variant="contained"
            sx={stopButtonSx}
            onClick={handleStopButtonClick}
          >
            Stop
          </Button>
        )}
        {messages.length > 0 && (
          <Button
            variant="contained"
            sx={downloadButtonSx}
            onClick={handleDownloadClick}
          >
            Download ({messages.length})
          </Button>
        )}
      </Box>
      <Box sx={{ mt: 2 }}>
        {messages.map((message, i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <SyntaxHighlighter language="json" style={codeStyle}>
              {JSON.stringify(message.json, undefined, 2)}
            </SyntaxHighlighter>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function handleErrors(response: any) {
  if (!response.ok) throw new Error(response.status)
  return response
}

function FetchEventTarget(url: string, options: any) {
  const utf8decoder = new TextDecoder()
  const eventTarget = new EventTarget()
  // fetch with connection timeout maybe? https://github.com/github/fetch/issues/175
  fetch(url, options)
    .then(handleErrors)
    .then(response => {
      eventTarget.dispatchEvent(new Event('open'))
      let streamBuf = ''
      let streamPos = 0
      const reader = response.body.getReader()
      return new ReadableStream({
        start(controller) {
          function pump() {
            //@ts-ignore
            return reader
              .read()
              .then(({ done, value }: any) => {
                // When no more data needs to be consumed, close the stream
                if (done) {
                  eventTarget.dispatchEvent(new CloseEvent('close'))
                  controller.close()
                  return
                }
                streamBuf += utf8decoder.decode(value)
                while (streamPos < streamBuf.length) {
                  if (streamBuf[streamPos] === '\n') {
                    const line = streamBuf.substring(0, streamPos)
                    eventTarget.dispatchEvent(
                      new MessageEvent('message', { data: JSON.parse(line) })
                    )
                    streamBuf = streamBuf.substring(streamPos + 1)
                    streamPos = 0
                  } else {
                    streamPos += 1
                  }
                }
                pump()
              })
              .catch((error: any) => {
                // Handle AbortError gracefully during stream reading
                if (error instanceof Error && error.name === 'AbortError') {
                  eventTarget.dispatchEvent(new CloseEvent('close'))
                  controller.close()
                } else {
                  eventTarget.dispatchEvent(
                    new CustomEvent('error', { detail: error })
                  )
                  controller.error(error)
                }
              })
          }
          return pump()
        },
      })
    })
    .catch((error: any) => {
      // Don't dispatch error events for AbortError as it's expected when stopping
      if (error instanceof Error && error.name !== 'AbortError') {
        eventTarget.dispatchEvent(new CustomEvent('error', { detail: error }))
      } else {
        // Dispatch close event for abort operations
        eventTarget.dispatchEvent(new CloseEvent('close'))
      }
    })
  return eventTarget
}
