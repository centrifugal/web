import { useContext, useEffect, useState, useRef } from 'react'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button'
import { green, red } from '@mui/material/colors';

import { compileExpression } from 'filtrex';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, solarizedLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import { messageCharacterSizeLimit } from 'config/messaging'
import { ShellContext } from 'contexts/ShellContext'

import PropTypes from 'prop-types';
import { RandomString } from 'utils/Functions';

import { SettingsContext } from '../../contexts/SettingsContext'

function getURL() {
  const proto = window.location.protocol;
  const baseURL = "http://localhost:8000/admin/trace" //`${proto}//${window.location.host}/admin/trace`;
  return baseURL;
}

export const Tracing = () => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [filter, setFilter] = useState('')
  const [isValidFilter, setIsValidFilter] = useState(true)
  const streamCancelRef = useRef<(() => void) | null>(null);
  const filterExprRef = useRef<((v: any) => boolean) | null>(null);
  const [traceType, setTraceType] = useState('user')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<any[]>([]);

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
    setTraceType((event.target as HTMLInputElement).value);
  };

  const buttonSx = {
    ...({
      bgcolor: green[500],
      '&:hover': {
        bgcolor: green[700],
      },
    }),
  };

  const stopButtonSx = {
    ...({
      ml: 2,
      bgcolor: red[500],
      '&:hover': {
        bgcolor: red[700],
      },
    }),
  };

  const filterSx = {
    ...(!isValidFilter && {
      input: {
        color: red[500],
      }
    }),
  };

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidFilter) {
      showAlert("Invalid filter expression", {
        severity: 'error'
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
  };

  const handleStopButtonClick = () => {
    setRunning(false)
    stopStream()
  };

  const stopStream = function() {
    if (streamCancelRef.current) {
      streamCancelRef.current()
      streamCancelRef.current = null
    }
    setRunning(false)
    // clearInterval(this.interval);
    // this.messages = [];
    // this.setState({
    //   running: false,
    // });
  }

  const startStream = function(traceType: string, traceEntity: string) {
    const abortController = new AbortController();
    const cancelFunc = () => { abortController.abort(); };
    streamCancelRef.current = cancelFunc
    //@ts-ignore
    const eventTarget = new FetchEventTarget(
      getURL(),
      {
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
      },
    );

    eventTarget.addEventListener('open', () => {
      // numFailures = 0;
    });

    eventTarget.addEventListener('message', (e: any) => {
      if (e.data === null) {
        // PING.
        return;
      }
      console.log(e.data);
      processStreamData(e.data);
    });

    const handleClose = () => {
      stopStream();
    };

    eventTarget.addEventListener('error', (error: any) => {
      handleClose();
    });

    eventTarget.addEventListener('close', () => {
      handleClose();
    });

    // this.setState({
    //   running: true,
    //   method,
    //   messages: [],
    //   errorMessage: '',
    // });
    // this.interval = setInterval(() => {
    //   this.setState({ messages: this.messages });
    // }, 1000);
  }

  const processStreamData = function(data: any) {
    if (filterExprRef.current !== null) {
      if (!filterExprRef.current(data)) {
        return;
      }
    }
    setMessages(messages => [{json: data, time: new Date().toLocaleTimeString()},...messages.slice(0, 99)]);
    console.log(messages)
  }

//     let messageLog;
//     if (method === 'user') {
//       messageLog = messages.map((message) => (
//         <div key={RandomString(16)} className="trace-row">
//           <div className="trace-row-header">
//             <span className="trace-row-time">{message.time}</span>
//           </div>
//           <PrettyPrintJson data={message.json} />
//         </div>
//       ));
//     } else if (method === 'channel') {
//       messageLog = messages.map((message) => {
//         return (
//           <div key={RandomString(16)} className="trace-row">
//             <div className="trace-row-header">
//               <span className="trace-row-time">{message.time}</span>
//             </div>
//             <PrettyPrintJson data={message.json} />
//           </div>
//         );
//       });
//     }

  return <Box component="form" onSubmit={handleFormSubmit} className="max-w-8xl mx-auto p-8">
    <FormControl>
      <FormLabel>Choose what to trace</FormLabel>
      <RadioGroup
        row
        aria-labelledby="row-radio-buttons-group-label"
        name="row-radio-buttons-group"
        defaultValue={"user"}
        onChange={handleChange}
      >
        <FormControlLabel value="user" control={<Radio />} label="User" />
        <FormControlLabel value="channel" control={<Radio />} label="Channel" />
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
        autoComplete='off'
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
        autoComplete='off'
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
        helperText={<span>Tracing uses <Link href="https://www.npmjs.com/package/filtrex" target={'_blank'}>filtrex v3</Link> as an expression language</span>}
        onChange={event => {
          setFilter(event.target.value)
          if (event.target.value) {
            try {
              compileExpression(event.target.value)
            } catch {
              setIsValidFilter(false)
              return;
            }
          }
          setIsValidFilter(true)
        }}
        value={filter}
        autoComplete='off'
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
    <Box sx={{mt: 2}}>
      {messages.map((message, i) => (
            <Box
              key={i}
              sx={{mb: 2}}
            >
              <SyntaxHighlighter language="json" style={codeStyle}>
                {JSON.stringify(message.json, undefined, 2)}
              </SyntaxHighlighter>
            </Box>
          ))}
    </Box>
  </Box>
}

// const classNames = require('classnames');

// class PrettyPrintJson extends React.Component {
//   render() {
//     // data could be a prop for example
//     const { data } = this.props;
//     return (<div><pre>{JSON.stringify(data, null, 2)}</pre></div>);
//   }
// }

// PrettyPrintJson.propTypes = {
//   // eslint-disable-next-line react/forbid-prop-types
//   data: PropTypes.any.isRequired,
// };

function handleErrors(response: any) {
  if (!response.ok) throw new Error(response.status);
  return response;
}

function FetchEventTarget(url: string, options: any) {
  const utf8decoder = new TextDecoder();
  const eventTarget = new EventTarget();
  // fetch with connection timeout maybe? https://github.com/github/fetch/issues/175
  fetch(url, options)
    .then(handleErrors)
    .then((response) => {
      eventTarget.dispatchEvent(new Event('open'));
      let streamBuf = '';
      let streamPos = 0;
      const reader = response.body.getReader();
      return new ReadableStream({
        start(controller) {
          function pump() {
            //@ts-ignore
            return reader.read().then(({ done, value }) => {
              // When no more data needs to be consumed, close the stream
              if (done) {
                eventTarget.dispatchEvent(new CloseEvent('close'));
                controller.close();
                return;
              }
              streamBuf += utf8decoder.decode(value);
              while (streamPos < streamBuf.length) {
                if (streamBuf[streamPos] === '\n') {
                  const line = streamBuf.substring(0, streamPos);
                  eventTarget.dispatchEvent(new MessageEvent('message', { data: JSON.parse(line) }));
                  streamBuf = streamBuf.substring(streamPos + 1);
                  streamPos = 0;
                } else {
                  streamPos += 1;
                }
              }
              pump();
            });
          }
          return pump();
        },
      });
    })
    .catch((error) => {
      eventTarget.dispatchEvent(new CustomEvent('error', { detail: error }));
    });
  return eventTarget;
}

// // eslint-disable-next-line react/prefer-stateless-function
// export default class TracingPage extends React.Component {
//   constructor() {
//     super();
//     this.formRef = React.createRef();
//     this.methodRef = React.createRef();
//     this.submitRef = React.createRef();
//     this.cancelRef = React.createRef();
//     this.entityFormRef = React.createRef();
//     this.messages = [];
//     this.state = {
//       method: 'user',
//       running: false,
//       messages: [],
//       errorMessage: '',
//     };
//     this.streamCancel = null;
//   }

//   componentDidMount() {
//     this.handleMethodChange();
//   }

//   componentWillUnmount() {
//     this.stopStream();
//   }

//   processStreamData(data) {
//     this.messages.unshift({
//       json: data,
//       time: new Date().toLocaleTimeString(),
//     });
//     this.messages = this.messages.slice(0, 100);
//   }

//   startStream(method, traceEntity) {
//     const abortController = new AbortController();
//     const cancelFunc = () => { abortController.abort(); };
//     this.streamCancel = cancelFunc;
//     const eventTarget = new FetchEventTarget(
//       getURL(),
//       {
//         method: 'POST',
//         headers: new Headers({
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//           Authorization: 'Token ' + localStorage.getItem('token'),
//         }),
//         mode: 'same-origin',
//         signal: abortController.signal,
//         body: JSON.stringify({
//           type: method,
//           entity: traceEntity,
//         }),
//       },
//     );

//     eventTarget.addEventListener('open', () => {
//       // numFailures = 0;
//     });

//     eventTarget.addEventListener('message', (e) => {
//       if (e.data === null) {
//         // PING.
//         return;
//       }
//       this.processStreamData(e.data);
//     });

//     const handleClose = () => {
//       this.stopStream();
//     };

//     eventTarget.addEventListener('error', (error) => {
//       if (error.detail.message === '404') {
//         this.setState({
//           errorMessage: '404: Tracing feature available in Centrifugo Pro version only',
//         });
//       }
//       handleClose();
//     });

//     eventTarget.addEventListener('close', () => {
//       handleClose();
//     });

//     this.setState({
//       running: true,
//       method,
//       messages: [],
//       errorMessage: '',
//     });
//     this.interval = setInterval(() => {
//       this.setState({ messages: this.messages });
//     }, 1000);
//   }

//   stopStream() {
//     if (this.streamCancel !== null) {
//       this.streamCancel();
//       this.streamCancel = null;
//     }
//     clearInterval(this.interval);
//     this.messages = [];
//     this.setState({
//       running: false,
//     });
//   }

//   handleMethodChange() {
//     const method = this.methodRef.current.value;
//     if (!method) {
//       return;
//     }
//     this.setState({
//       method,
//     });
//   }

//   handleSubmit(e) {
//     e.preventDefault();
//     const { running } = this.state;
//     if (running) {
//       this.stopStream();
//       return;
//     }
//     const method = this.state.method;
//     let traceEntity;
//     if (this.entityFormRef.current) {
//       const result = this.entityFormRef.current.getEntity();
//       if (result.error) {
//         this.setState({ errorMessage: result.error });
//         return;
//       }
//       traceEntity = result.entity;
//     } else {
//       traceEntity = '';
//     }

//     this.startStream(method, traceEntity);
//   }

//   render() {
//     const {
//       messages, running, method, errorMessage,
//     } = this.state;
//     const loaderClasses = classNames({ 'trace-loader': true, 'd-none': !running });
//     const errorClasses = classNames({ box: true, 'box-error': true, 'd-none': errorMessage === '' });
//     let buttonText = 'Start';
//     if (running) {
//       buttonText = 'Stop';
//     }
//     let messageLog;
//     if (method === 'user') {
//       messageLog = messages.map((message) => (
//         <div key={RandomString(16)} className="trace-row">
//           <div className="trace-row-header">
//             <span className="trace-row-time">{message.time}</span>
//           </div>
//           <PrettyPrintJson data={message.json} />
//         </div>
//       ));
//     } else if (method === 'channel') {
//       messageLog = messages.map((message) => {
//         return (
//           <div key={RandomString(16)} className="trace-row">
//             <div className="trace-row-header">
//               <span className="trace-row-time">{message.time}</span>
//             </div>
//             <PrettyPrintJson data={message.json} />
//           </div>
//         );
//       });
//     }

//     let paramsForm;
//     if (method === 'user') {
//       paramsForm = <UserForm ref={this.entityFormRef} />;
//     } else {
//       paramsForm = <ChannelForm ref={this.entityFormRef} />;
//     }

//     return (
//       <main className="p-3 animated fadeIn">
//         <p className="lead">Trace Centrifugo events in real-time</p>
//         <form ref={this.formRef} method="POST" action="" onSubmit={this.handleSubmit.bind(this)}>
//           <div className="form-group">
//             Choose what to trace
//             <select className="form-control" ref={this.methodRef} name="method" id="method" onChange={this.handleMethodChange.bind(this)}>
//               <option value="user">Trace User</option>
//               <option value="channel">Trace Channel</option>
//             </select>
//           </div>
//           {paramsForm}
//           <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">{buttonText}</button>
//           <button type="button" ref={this.cancelRef} disabled={false} className="btn btn-secondary d-none">Cancel</button>
//           <span id="errorBox" className={errorClasses}>{errorMessage}</span>
//           <span className={loaderClasses}>
//             <div className="loading">
//               <div className="loading-bar" />
//               <div className="loading-bar" />
//               <div className="loading-bar" />
//               <div className="loading-bar" />
//             </div>
//           </span>
//         </form>
//         {/* https://github.com/mac-s-g/react-json-view ? */}
//         <div className="trace-area">
//           {messageLog}
//         </div>
//       </main>
//     );
//   }
// }

// TracingPage.propTypes = {
//   // eslint-disable-next-line react/forbid-prop-types
// };

// class ChannelForm extends React.Component {
//   constructor() {
//     super();
//     this.onChannelChange = this.onChannelChange.bind(this);
//     this.state = {
//       channel: '',
//     };
//   }

//   onChannelChange(e) {
//     this.setState({ channel: e.target.value });
//   }

//   getEntity() {
//     const channel = this.state.channel;
//     if (!channel) {
//       return { error: 'Empty channel' };
//     }
//     return {
//       entity: channel,
//     };
//   }

//   render() {
//     return (
//       <div>
//         <div className="form-group">
//           Channel
//           <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
//         </div>
//       </div>
//     );
//   }
// }

// class UserForm extends React.Component {
//   constructor() {
//     super();
//     this.onUserChange = this.onUserChange.bind(this);
//     this.state = {
//       user: '',
//     };
//   }

//   onUserChange(e) {
//     this.setState({ user: e.target.value });
//   }

//   getEntity() {
//     const user = this.state.user;
//     if (!user) {
//       return { error: 'Empty user ID' };
//     }
//     return {
//       entity: user,
//     };
//   }

//   render() {
//     return (
//       <div>
//         <div className="form-group">
//           User ID
//           <input type="text" onChange={this.onUserChange} autoComplete="off" className="form-control" name="user" id="user" />
//         </div>
//       </div>
//     );
//   }
// }
