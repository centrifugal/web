import { useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import { Grid } from '@mui/material'
import { green, red } from '@mui/material/colors'
import CircularProgress from '@mui/material/CircularProgress'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'

import AceEditor from 'react-ace'

import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  a11yDark,
  solarizedLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'

import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-monokai'
import 'ace-builds/src-noconflict/theme-solarized_light'
import 'ace-builds/src-noconflict/ext-language_tools'

const globalUrlPrefix = 'http://localhost:8000/' // window.location.pathname

interface ActionsProps {
  handleLogout: () => void
}

export const Actions = ({ handleLogout }: ActionsProps) => {
  const { setTitle } = useContext(ShellContext)

  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode
  const [method, setMethod] = useState('publish')
  const [loading, setLoading] = useState(false)
  const [request, setRequest] = useState<any | null>(null)
  const [response, setResponse] = useState<any | null>(null)

  let codeStyle = solarizedLight
  if (colorMode === 'dark') {
    codeStyle = a11yDark
  }

  const sendRequest = (params: any) => {
    setLoading(true)

    const headers: any = {
      Accept: 'application/json',
    }
    // const { insecure } = this.props;
    // if (!insecure) {
    headers.Authorization = `token ${localStorage.getItem('token')}`
    // }

    const request = {
      method: method,
      params: params,
    }

    setRequest(request)

    fetch(`${globalUrlPrefix}admin/api`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(request),
      mode: 'cors',
    })
      .then(response => {
        if (!response.ok) {
          setLoading(false)
          if (response.status === 401) {
            handleLogout()
            return
          }
          throw Error(response.status.toString())
        }
        return response.json()
      })
      .then(data => {
        setResponse(data)
        setLoading(false)
      })
      .catch(e => {
        console.log(e)
        setLoading(false)
      })
  }

  const handleMethodChange = (event: SelectChangeEvent) => {
    setMethod(event.target.value)
    setRequest(null)
    setResponse(null)
    console.log(event.target.value)
  }

  useEffect(() => {
    setTitle('Centrifugo | Actions')
  }, [setTitle])

  let FormElem
  if (method === 'publish') {
    FormElem = (
      <PublishForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'broadcast') {
    FormElem = (
      <BroadcastForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'presence') {
    FormElem = (
      <PresenceForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'presence_stats') {
    FormElem = (
      <PresenceStatsForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'history') {
    FormElem = (
      <HistoryForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'history_remove') {
    FormElem = (
      <HistoryRemoveForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'subscribe') {
    FormElem = (
      <SubscribeForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'unsubscribe') {
    FormElem = (
      <UnsubscribeForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'disconnect') {
    FormElem = (
      <DisconnectForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'info') {
    FormElem = (
      <InfoForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'rpc') {
    FormElem = (
      <RpcForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'channels') {
    FormElem = (
      <ChannelsForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'connections') {
    FormElem = (
      <ConnectionsForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'update_user_status') {
    FormElem = (
      <UpdateUserStatusForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'get_user_status') {
    FormElem = (
      <GetUserStatusForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'delete_user_status') {
    FormElem = (
      <DeleteUserStatusForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'block_user') {
    FormElem = (
      <BlockUserForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'unblock_user') {
    FormElem = (
      <UnblockUserForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'revoke_token') {
    FormElem = (
      <RevokeTokenForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else if (method === 'invalidate_user_tokens') {
    FormElem = (
      <InvalidateUserTokensForm
        colorMode={colorMode}
        loading={loading}
        sendRequest={sendRequest}
      />
    )
  } else {
    FormElem = <></>
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <FormControl fullWidth sx={{}}>
        <InputLabel htmlFor="grouped-native-select">Method</InputLabel>
        <Select
          fullWidth
          native
          defaultValue={method}
          label="Method"
          onChange={handleMethodChange}
        >
          <optgroup label="OSS">
            <option value={'publish'}>Publish</option>
            <option value={'broadcast'}>Broadcast</option>
            <option value={'presence'}>Presence</option>
            <option value={'presence_stats'}>Presence Stats</option>
            <option value={'history'}>History</option>
            <option value={'history_remove'}>History Remove</option>
            <option value={'subscribe'}>Subscribe</option>
            <option value={'unsubscribe'}>Unsubscribe</option>
            <option value={'disconnect'}>Disconnect</option>
            <option value={'info'}>Info</option>
            <option value={'rpc'}>RPC</option>
            <option value={'channels'}>Channels</option>
          </optgroup>
          <optgroup label="PRO">
            <option value={'connections'}>Connections</option>
            <option value={'update_user_status'}>Update user status</option>
            <option value={'get_user_status'}>Get user status</option>
            <option value={'delete_user_status'}>Delete user status</option>
            <option value={'block_user'}>Block user</option>
            <option value={'unblock_user'}>Unblock user</option>
            <option value={'revoke_token'}>Revoke token</option>
            <option value={'invalidate_user_tokens'}>
              Invalidate user tokens
            </option>
          </optgroup>
        </Select>
      </FormControl>
      {FormElem}
      {request && response ? (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={4}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Request
            </Typography>
            <SyntaxHighlighter language="json" style={codeStyle}>
              {JSON.stringify(request, undefined, 2)}
            </SyntaxHighlighter>
          </Grid>
          <Grid item xs={8}>
            <Typography variant="h6" sx={{ mb: 1 }}>
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
            <SyntaxHighlighter language="json" style={codeStyle}>
              {!response.error
                ? JSON.stringify(response.result, undefined, 2)
                : JSON.stringify(response.error, undefined, 2)}
            </SyntaxHighlighter>
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
        <Button
          type="submit"
          variant="contained"
          // sx={buttonSx}
          disabled={loading}
        >
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
      showAlert('User of CEL expression required', {severity: 'error'})
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
        helperText="Unix seconds"
        onChange={event => setBefore(parseInt(event.target.value))}
        value={exp}
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
