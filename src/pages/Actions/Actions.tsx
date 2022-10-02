import { useContext, useEffect, useState, useRef } from 'react'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import LinearProgress from '@mui/material/LinearProgress';
import { Grid } from '@mui/material'
import { green, red } from '@mui/material/colors';
import CircularProgress from '@mui/material/CircularProgress';

import AceEditor from "react-ace"

import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, solarizedLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import { ShellContext } from 'contexts/ShellContext'

import { PrettifyJson } from 'utils/Functions'

import { SettingsContext } from '../../contexts/SettingsContext'

import "ace-builds/src-noconflict/mode-json"
import "ace-builds/src-noconflict/theme-monokai"
import "ace-builds/src-noconflict/theme-solarized_light"
import "ace-builds/src-noconflict/ext-language_tools"


function onChange(newValue: any) {
  console.log("change", newValue)
}

export const Actions = () => {
  const { setTitle } = useContext(ShellContext)

  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode

  let codeStyle = solarizedLight
  if (colorMode === 'dark') {
    codeStyle = a11yDark
  }

  useEffect(() => {
    setTitle('Centrifugo | Actions')
  }, [setTitle])

  return <Box className="max-w-8xl mx-auto p-8">
    <FormControl fullWidth sx={{ }}>
      <InputLabel htmlFor="grouped-native-select">Method</InputLabel>
      <Select fullWidth native defaultValue="publish" label="Method">
        <optgroup label="OSS">
          <option value={"publish"}>Publish</option>
          <option value={"broadcast"}>Broadcast</option>
          <option value={"presence"}>Presence</option>
          <option value={"presence_stats"}>Presence Stats</option>
          <option value={"history"}>History</option>
          <option value={"history_remove"}>History Remove</option>
          <option value={"subscribe"}>Subscribe</option>
          <option value={"unsubscribe"}>Unsubscribe</option>
          <option value={"disconnect"}>Disconnect</option>
          <option value={"refresh"}>Refresh</option>
          <option value={"info"}>Info</option>
          <option value={"rpc"}>RPC</option>
          <option value={"channels"}>Channels</option>
        </optgroup>
        <optgroup label="PRO">
          <option value={"connections"}>Connections</option>
          <option value={"update_user_status"}>Update user status</option>
          <option value={"get_user_status"}>Get user status</option>
          <option value={"delete_user_status"}>Delete user status</option>
          <option value={"block_user"}>Block user</option>
          <option value={"unblock_user"}>Unblock user</option>
          <option value={"revoke_token"}>Revoke token</option>
          <option value={"invalidate_user_tokens"}>Invalidate user tokens</option>
        </optgroup>
      </Select>
    </FormControl>
    <PublishForm colorMode={colorMode} />
    <Grid container spacing={2} sx={{mt: 1}}>
      <Grid item xs={4}>
        <Typography variant='h6'>
          Request
        </Typography>
        <SyntaxHighlighter language="json" style={codeStyle}>
          {JSON.stringify({"a": 1}, undefined, 2)}
        </SyntaxHighlighter>
      </Grid>
      <Grid item xs={8}>
        <Typography variant='h6'>
          Response
        </Typography>
        <SyntaxHighlighter language="json" style={codeStyle}>
          {JSON.stringify({"b": 1}, undefined, 2)}
        </SyntaxHighlighter>
      </Grid>
    </Grid>
  </Box>
}

interface FormProps {
  colorMode: string
}

export const PublishForm = ({ colorMode }: FormProps) => {
  const [channel, setChannel] = useState('')
  const [data, setData] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const onDataChange = (newValue: any) => {
    console.log(newValue);
  }

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
    };
  }, []);

  const buttonSx = {
    ...(success && {
      bgcolor: green[500],
      '&:hover': {
        bgcolor: green[700],
      },
    }),
  };

  const handleButtonClick = () => {
    if (!loading) {
      setSuccess(false);
      setLoading(true);
      timer.current = window.setTimeout(() => {
        setSuccess(true);
        setLoading(false);
      }, 2000);
    }
  };

  return <Box
    component="form"
    onSubmit={handleFormSubmit}
    sx={{ mt: 0 }}
  >
    <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete='off'
        onChange={event => setChannel(event.target.value)}
        value={channel}
    />
    <AceEditor
      mode="json"
      theme={colorMode === 'dark'? 'monokai': 'solarized_light'}
      width="100%"
      height="300px"
      showGutter={false}
      onChange={onDataChange}
      name="data-editor-publish"
      fontSize={18}
      tabSize={2}
      showPrintMargin={false}
      placeholder="Data*"
      setOptions={{
        enableLiveAutocompletion: true,
        enableSnippets: true,
        useWorker: false
      }}
      editorProps={{ $blockScrolling: true }}
    />
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
      <Box sx={{ position: 'relative' }}>
      <Button
          type="submit"
          variant="contained"
          sx={buttonSx}
          disabled={loading}
          onClick={handleButtonClick}
        >
          Publish
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
  </Box>
}

// class PublishForm extends React.Component {
//   constructor() {
//     super();
//     this.onChannelChange = this.onChannelChange.bind(this);
//     this.onDataChange = this.onDataChange.bind(this);
//     this.state = {
//       channel: '',
//       data: '',
//     };
//   }

//   onChannelChange(e) {
//     this.setState({ channel: e.target.value });
//   }

//   onDataChange(value) {
//     this.setState({ data: value });
//   }

//   getParams() {
//     const channel = this.state.channel;
//     const data = this.state.data;
//     if (!channel) {
//       return { error: 'Empty channel' };
//     }
//     let dataJSON;
//     try {
//       dataJSON = JSON.parse(data);
//     } catch (e) {
//       return { error: 'Invalid data JSON' };
//     }
//     return {
//       params: {
//         channel,
//         data: dataJSON,
//       },
//     };
//   }

//   render() {
//     return (
//       <div>
//         <div className="form-group">
//           Channel
//           <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
//         </div>
//         <div className="form-group">
//           Data
//           <AceEditor
//             mode="json"
//             theme="monokai"
//             onChange={this.onDataChange}
//             name="data-editor-publish"
//             editorProps={{ $blockScrolling: true }}
//             width="100%"
//             height="300px"
//             showGutter={false}
//             onLoad={onLoadFunction}
//             setOptions={{ useWorker: false }}
//           />
//         </div>
//       </div>
//     );
//   }
// }