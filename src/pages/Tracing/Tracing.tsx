import { useContext, useEffect, useState, useRef } from 'react'
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
import { green, red } from '@mui/material/colors'
import { compileExpression } from 'filtrex'
import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  a11yDark,
  solarizedLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'

const globalUrlPrefix = 'http://localhost:8000/' // window.location.pathname


export const Tracing = () => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [filter, setFilter] = useState('')
  const [isValidFilter, setIsValidFilter] = useState(true)
  const streamCancelRef = useRef<(() => void) | null>(null)
  const filterExprRef = useRef<((v: any) => boolean) | null>(null)
  const [traceType, setTraceType] = useState('user')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<any[]>([])

  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode

  let codeStyle = solarizedLight
  if (colorMode === 'dark') {
    codeStyle = a11yDark
  }

  useEffect(() => {
    setTitle('Centrifugo | Tracing')
  }, [setTitle])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (running) {
      setRunning(false)
    }
    setFilter('')
    setTraceType((event.target as HTMLInputElement).value)
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
      filterExprRef.current = compileExpression(filter)
    } else {
      filterExprRef.current = null
    }
    startStream(traceType, traceType === 'user' ? user : channel)
    setMessages([])
  }

  const handleStopButtonClick = () => {
    setRunning(false)
    stopStream()
  }

  const stopStream = function () {
    if (streamCancelRef.current) {
      streamCancelRef.current()
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
        Authorization: 'Token ' + localStorage.getItem('token'),
      }),
      mode: 'cors',
      signal: abortController.signal,
      body: JSON.stringify({
        type: traceType,
        entity: traceEntity,
      }),
    })

    eventTarget.addEventListener('open', () => {
      // numFailures = 0;
    })

    eventTarget.addEventListener('message', (e: any) => {
      if (e.data === null) {
        // PING.
        return
      }
      console.log(e.data)
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
    if (filterExprRef.current !== null) {
      if (!filterExprRef.current(data)) {
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
        <FormLabel>Choose what to trace</FormLabel>
        <RadioGroup
          row
          aria-labelledby="row-radio-buttons-group-label"
          name="row-radio-buttons-group"
          defaultValue={'user'}
          onChange={handleChange}
        >
          <FormControlLabel value="user" control={<Radio />} label="User" />
          <FormControlLabel
            value="channel"
            control={<Radio />}
            label="Channel"
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
      ) : (
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
            Optionally filter tracing messages on the client side by using{' '}
            <Link
              href="https://www.npmjs.com/package/filtrex/v/2.2.3"
              target={'_blank'}
            >
              filtrex v2.2.3
            </Link>{' '}
            as an expression language
          </span>
        }
        onChange={event => {
          setFilter(event.target.value)
          if (event.target.value) {
            try {
              compileExpression(event.target.value)
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
            return reader.read().then(({ done, value }) => {
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
          }
          return pump()
        },
      })
    })
    .catch(error => {
      eventTarget.dispatchEvent(new CustomEvent('error', { detail: error }))
    })
  return eventTarget
}
