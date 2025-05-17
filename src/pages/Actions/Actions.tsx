import { useContext, useEffect, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import {
  Autocomplete,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
} from '@mui/material'
import { green, red } from '@mui/material/colors'
import CircularProgress from '@mui/material/CircularProgress'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import AceEditor from 'react-ace'

import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  a11yDark,
  solarizedLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'

import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-monokai'
import 'ace-builds/src-noconflict/theme-solarized_light'
import 'ace-builds/src-noconflict/ext-language_tools'

interface ActionsProps {
  signinSilent: () => void
  authorization: string
  edition: 'oss' | 'pro'
}

interface MethodOption {
  value: string
  name: string
  category: string
}

// Define method lists outside component to avoid recreation
const coreMethods: MethodOption[] = [
  { value: 'publish', name: 'Publish', category: 'OSS' },
  { value: 'broadcast', name: 'Broadcast', category: 'OSS' },
  { value: 'presence', name: 'Presence', category: 'OSS' },
  { value: 'presence_stats', name: 'Presence Stats', category: 'OSS' },
  { value: 'history', name: 'History', category: 'OSS' },
  { value: 'history_remove', name: 'History Remove', category: 'OSS' },
  { value: 'subscribe', name: 'Subscribe', category: 'OSS' },
  { value: 'unsubscribe', name: 'Unsubscribe', category: 'OSS' },
  { value: 'disconnect', name: 'Disconnect', category: 'OSS' },
  { value: 'info', name: 'Info', category: 'OSS' },
  { value: 'rpc', name: 'RPC', category: 'OSS' },
  { value: 'channels', name: 'Channels', category: 'OSS' },
]

const proMethods: MethodOption[] = [
  { value: 'connections', name: 'Connections', category: 'PRO' },
  { value: 'update_user_status', name: 'Update user status', category: 'PRO' },
  { value: 'get_user_status', name: 'Get user status', category: 'PRO' },
  { value: 'delete_user_status', name: 'Delete user status', category: 'PRO' },
  { value: 'block_user', name: 'Block user', category: 'PRO' },
  { value: 'unblock_user', name: 'Unblock user', category: 'PRO' },
  { value: 'revoke_token', name: 'Revoke token', category: 'PRO' },
  {
    value: 'invalidate_user_tokens',
    name: 'Invalidate user tokens',
    category: 'PRO',
  },
]

export const Actions = ({
  signinSilent,
  authorization,
  edition,
}: ActionsProps) => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode

  const [method, setMethod] = useState<string>('publish')
  const [loading, setLoading] = useState<boolean>(false)
  const [request, setRequest] = useState<any | null>(null)
  const [response, setResponse] = useState<any | null>(null)

  // Choose code style based on theme
  const codeStyle = useMemo(
    () => (colorMode === 'dark' ? a11yDark : solarizedLight),
    [colorMode]
  )

  // Combine method options, memoized on edition
  const methodOptions = useMemo<MethodOption[]>(
    () => (edition === 'pro' ? [...coreMethods, ...proMethods] : coreMethods),
    [edition]
  )

  // Send API request
  const sendRequest = (params: any) => {
    setLoading(true)
    setRequest({ method, params })

    fetch(`${globalUrlPrefix}admin/api`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({ method, params }),
      mode: 'same-origin',
    })
      .then(res => {
        if (!res.ok) {
          setLoading(false)
          if (res.status === 401) {
            showAlert('Unauthorized', { severity: 'error' })
            signinSilent()
            return Promise.reject()
          }
          if (res.status === 403) {
            showAlert('Permission denied', { severity: 'error' })
            return Promise.reject()
          }
          return Promise.reject(new Error(res.status.toString()))
        }
        return res.json()
      })
      .then(data => {
        setResponse(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  // Handle method selection change
  const handleMethodChange = (_: any, option: MethodOption | null) => {
    setMethod(option?.value || 'publish')
    setRequest(null)
    setResponse(null)
  }

  useEffect(() => {
    setTitle('Centrifugo | Actions')
  }, [setTitle])

  // Map of form components
  const formProps = { colorMode, loading, sendRequest }
  const formMap: Record<string, JSX.Element> = {
    publish: <PublishForm {...formProps} />,
    broadcast: <BroadcastForm {...formProps} />,
    presence: <PresenceForm {...formProps} />,
    presence_stats: <PresenceStatsForm {...formProps} />,
    history: <HistoryForm {...formProps} />,
    history_remove: <HistoryRemoveForm {...formProps} />,
    subscribe: <SubscribeForm {...formProps} />,
    unsubscribe: <UnsubscribeForm {...formProps} />,
    disconnect: <DisconnectForm {...formProps} />,
    info: <InfoForm {...formProps} />,
    rpc: <RpcForm {...formProps} />,
    channels: <ChannelsForm {...formProps} />,
    connections: <ConnectionsForm {...formProps} />,
    update_user_status: <UpdateUserStatusForm {...formProps} />,
    get_user_status: <GetUserStatusForm {...formProps} />,
    delete_user_status: <DeleteUserStatusForm {...formProps} />,
    block_user: <BlockUserForm {...formProps} />,
    unblock_user: <UnblockUserForm {...formProps} />,
    revoke_token: <RevokeTokenForm {...formProps} />,
    invalidate_user_tokens: <InvalidateUserTokensForm {...formProps} />,
  }
  const FormElem = formMap[method] || null

  const copyToClipboard = (text: string) => () => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Execute server API command
      </Typography>
      <FormControl fullWidth sx={{}}>
        <Autocomplete
          value={methodOptions.find((opt: any) => opt.value === method) || null}
          onChange={handleMethodChange}
          options={methodOptions}
          // {...(edition === 'pro'
          //   ? { groupBy: (opt: MethodOption) => opt.category }
          //   : {})}
          getOptionLabel={(opt: MethodOption) => opt.name}
          renderInput={params => (
            <TextField
              {...params}
              label="Method"
              variant="outlined"
              fullWidth
            />
          )}
        />
      </FormControl>
      {FormElem}
      {request && response ? (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6">Request</Typography>
                  <IconButton
                    size="small"
                    onClick={copyToClipboard(JSON.stringify(request, null, 2))}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />
                <SyntaxHighlighter language="json" style={codeStyle}>
                  {JSON.stringify(request, null, 2)}
                </SyntaxHighlighter>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6">
                    Response{' '}
                    {!response.error ? (
                      <Box component="span" sx={{ color: green[500] }}>
                        OK
                      </Box>
                    ) : (
                      <Box component="span" sx={{ color: red[500] }}>
                        ERROR
                      </Box>
                    )}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={copyToClipboard(
                      JSON.stringify(
                        !response.error ? response.result : response.error,
                        null,
                        2
                      )
                    )}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />
                <SyntaxHighlighter language="json" style={codeStyle}>
                  {!response.error
                    ? JSON.stringify(response.result, null, 2)
                    : JSON.stringify(response.error, null, 2)}
                </SyntaxHighlighter>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <></>
      )}
    </Box>
  )
}

interface SubmitButtonProps {
  loading: boolean
  text: string
}

export const SubmitButton = ({ loading, text }: SubmitButtonProps) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
      <Box sx={{ position: 'relative' }}>
        <Button type="submit" variant="contained" disabled={loading}>
          {text}
        </Button>
        {loading && (
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
    </Box>
  )
}

interface AceFieldProps {
  colorMode: 'light' | 'dark'
  onChange: (value: string, event?: any) => void
}

export const AceField = ({ colorMode, onChange }: AceFieldProps) => {
  return (
    <AceEditor
      mode="json"
      theme={colorMode === 'dark' ? 'monokai' : 'solarized_light'}
      width="100%"
      height="300px"
      showGutter={false}
      onChange={onChange}
      name="data-editor-publish"
      fontSize={18}
      tabSize={2}
      showPrintMargin={false}
      placeholder="Data*"
      setOptions={{
        useWorker: false,
      }}
      editorProps={{ $blockScrolling: true }}
    />
  )
}

interface FormProps {
  colorMode: 'light' | 'dark'
  loading: boolean
  sendRequest: (req: any) => void
}

export const PublishForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [data, setData] = useState<any | null>(null)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    sendRequest({ channel: channel, data: jsonData })
  }

  const onDataChange = (newValue: any) => {
    setData(newValue)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <AceField colorMode={colorMode} onChange={onDataChange} />
      <SubmitButton loading={loading} text="Publish" />
    </Box>
  )
}

export const BroadcastForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [data, setData] = useState<any | null>(null)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    sendRequest({ channels: channel.split(' '), data: jsonData })
  }

  const onDataChange = (newValue: any) => {
    setData(newValue)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channels"
        type="text"
        id="text"
        helperText="Space-separated list of channels"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <AceField colorMode={colorMode} onChange={onDataChange} />
      <SubmitButton loading={loading} text="Broadcast" />
    </Box>
  )
}

export const PresenceForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Presence" />
    </Box>
  )
}

export const PresenceStatsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Presence Stats" />
    </Box>
  )
}

export const HistoryForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const [channel, setChannel] = useState('')
  const [limit, setLimit] = useState(0)
  const [offset, setOffset] = useState<number | null>(null)
  const [epoch, setEpoch] = useState<string>('')
  const [reverse, setReverse] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel: channel, limit: limit, reverse: reverse }
    if (offset !== null) {
      params.since = { offset: offset, epoch: epoch }
    }
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        fullWidth
        required
        name="limit"
        label="Limit"
        type="number"
        id="text"
        autoComplete="off"
        onChange={event => setLimit(parseInt(event.target.value))}
        value={limit}
      />

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField
            margin="normal"
            fullWidth
            name="offset"
            label="Since offset"
            type="number"
            id="text"
            autoComplete="off"
            onChange={event => {
              if (event.target.value === '') {
                setOffset(null)
              } else {
                setOffset(parseInt(event.target.value))
              }
            }}
            value={offset}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            margin="normal"
            fullWidth
            name="epoch"
            label="Since epoch"
            type="text"
            id="text"
            autoComplete="off"
            onChange={event => setEpoch(event.target.value)}
            value={epoch}
          />
        </Grid>
      </Grid>

      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox onChange={event => setReverse(event.target.checked)} />
          }
          label="Reverse"
          checked={reverse}
        />
      </FormGroup>
      <SubmitButton loading={loading} text="History" />
    </Box>
  )
}

export const HistoryRemoveForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="History Remove" />
    </Box>
  )
}

export const SubscribeForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel, user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Subscribe" />
    </Box>
  )
}

export const UnsubscribeForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel, user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Unsubscribe" />
    </Box>
  )
}

export const DisconnectForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Disconnect" />
    </Box>
  )
}

export const InfoForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({})
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <SubmitButton loading={loading} text="Info" />
    </Box>
  )
}

export const ChannelsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [pattern, setPattern] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ pattern: pattern })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        name="pattern"
        label="Pattern"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setPattern(event.target.value)}
        value={pattern}
      />
      <SubmitButton loading={loading} text="Channels" />
    </Box>
  )
}

export const RpcForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [method, setMethod] = useState('')
  const [data, setData] = useState<any | null>(null)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    sendRequest({ method: method, data: jsonData })
  }

  const onDataChange = (newValue: any) => {
    setData(newValue)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="method"
        label="Method"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setMethod(event.target.value)}
        value={method}
      />
      <AceField colorMode={colorMode} onChange={onDataChange} />
      <SubmitButton loading={loading} text="RPC" />
    </Box>
  )
}

export const ConnectionsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [expression, setExpression] = useState('')
  const { showAlert } = useContext(ShellContext)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user && !expression) {
      showAlert('User of CEL expression required', { severity: 'error' })
      return
    }
    sendRequest({ user: user, expression: expression })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        fullWidth
        name="expression"
        label="CEL expression"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setExpression(event.target.value)}
        value={expression}
      />
      <SubmitButton loading={loading} text="Connections" />
    </Box>
  )
}

export const UpdateUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Update user status" />
    </Box>
  )
}

export const GetUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Get user status" />
    </Box>
  )
}

export const DeleteUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Delete user status" />
    </Box>
  )
}

export const BlockUserForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [exp, setExp] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user, expire_at: exp })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Block user" />
    </Box>
  )
}

export const UnblockUserForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Unblock user" />
    </Box>
  )
}

export const InvalidateUserTokensForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [exp, setExp] = useState(0)
  const [before, setBefore] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user, expire_at: exp, issued_before: before })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="before"
        label="Tokens issued before"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value tells server to use current time"
        onChange={event => setBefore(parseInt(event.target.value))}
        value={before}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Invalidate user tokens" />
    </Box>
  )
}

export const RevokeTokenForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [uid, setUid] = useState('')
  const [exp, setExp] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ uid: uid, expire_at: exp })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="uid"
        label="Token uid (jti)"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUid(event.target.value)}
        value={uid}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Revoke token" />
    </Box>
  )
}
