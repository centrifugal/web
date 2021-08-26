// eslint-disable-next-line max-classes-per-file
import React from 'react';
import PropTypes from 'prop-types';
import { RandomString } from '../functions/Functions';

const classNames = require('classnames');

function getURL() {
  const proto = window.location.protocol;
  const baseURL = `${proto}//${window.location.host}${window.location.pathname}admin/trace`;
  return baseURL;
}

class PrettyPrintJson extends React.Component {
  render() {
    // data could be a prop for example
    const { data } = this.props;
    return (<div><pre>{JSON.stringify(data, null, 2)}</pre></div>);
  }
}

PrettyPrintJson.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  data: PropTypes.any.isRequired,
};

function handleErrors(response) {
  if (!response.ok) throw new Error(response.status);
  return response;
}

function FetchEventTarget(url, options) {
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

// eslint-disable-next-line react/prefer-stateless-function
export default class TracingPage extends React.Component {
  constructor() {
    super();
    this.formRef = React.createRef();
    this.methodRef = React.createRef();
    this.submitRef = React.createRef();
    this.cancelRef = React.createRef();
    this.entityFormRef = React.createRef();
    this.messages = [];
    this.state = {
      method: 'user',
      running: false,
      messages: [],
      errorMessage: '',
    };
    this.streamCancel = null;
  }

  componentDidMount() {
    this.handleMethodChange();
  }

  componentWillUnmount() {
    this.stopStream();
  }

  processStreamData(data) {
    this.messages.unshift({
      json: data,
      time: new Date().toLocaleTimeString(),
    });
    this.messages = this.messages.slice(0, 100);
  }

  startStream(method, traceEntity) {
    const abortController = new AbortController();
    const cancelFunc = () => { abortController.abort(); };
    this.streamCancel = cancelFunc;
    const eventTarget = new FetchEventTarget(
      getURL(),
      {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Token ' + localStorage.getItem('token'),
        }),
        mode: 'same-origin',
        signal: abortController.signal,
        body: JSON.stringify({
          type: method,
          entity: traceEntity,
        }),
      },
    );

    eventTarget.addEventListener('open', () => {
      // numFailures = 0;
    });

    eventTarget.addEventListener('message', (e) => {
      if (e.data === null) {
        // PING.
        return;
      }
      this.processStreamData(e.data);
    });

    const handleClose = () => {
      this.stopStream();
    };

    eventTarget.addEventListener('error', (error) => {
      if (error.detail.message === '404') {
        this.setState({
          errorMessage: '404: Tracing feature available in Centrifugo Pro version only',
        });
      }
      handleClose();
    });

    eventTarget.addEventListener('close', () => {
      handleClose();
    });

    this.setState({
      running: true,
      method,
      messages: [],
      errorMessage: '',
    });
    this.interval = setInterval(() => {
      this.setState({ messages: this.messages });
    }, 1000);
  }

  stopStream() {
    if (this.streamCancel !== null) {
      this.streamCancel();
      this.streamCancel = null;
    }
    clearInterval(this.interval);
    this.messages = [];
    this.setState({
      running: false,
    });
  }

  handleMethodChange() {
    const method = this.methodRef.current.value;
    if (!method) {
      return;
    }
    this.setState({
      method,
    });
  }

  handleSubmit(e) {
    e.preventDefault();
    const { running } = this.state;
    if (running) {
      this.stopStream();
      return;
    }
    const method = this.state.method;
    let traceEntity;
    if (this.entityFormRef.current) {
      const result = this.entityFormRef.current.getEntity();
      if (result.error) {
        this.setState({ errorMessage: result.error });
        return;
      }
      traceEntity = result.entity;
    } else {
      traceEntity = '';
    }

    this.startStream(method, traceEntity);
  }

  render() {
    const {
      messages, running, method, errorMessage,
    } = this.state;
    const loaderClasses = classNames({ 'trace-loader': true, 'd-none': !running });
    const errorClasses = classNames({ box: true, 'box-error': true, 'd-none': errorMessage === '' });
    let buttonText = 'Start';
    if (running) {
      buttonText = 'Stop';
    }
    let messageLog;
    if (method === 'user') {
      messageLog = messages.map((message) => (
        <div key={RandomString(16)} className="trace-row">
          <div className="trace-row-header">
            <span className="trace-row-time">{message.time}</span>
          </div>
          <PrettyPrintJson data={message.json} />
        </div>
      ));
    } else if (method === 'channel') {
      messageLog = messages.map((message) => {
        return (
          <div key={RandomString(16)} className="trace-row">
            <div className="trace-row-header">
              <span className="trace-row-time">{message.time}</span>
            </div>
            <PrettyPrintJson data={message.json} />
          </div>
        );
      });
    }

    let paramsForm;
    if (method === 'user') {
      paramsForm = <UserForm ref={this.entityFormRef} />;
    } else {
      paramsForm = <ChannelForm ref={this.entityFormRef} />;
    }

    return (
      <main className="p-3 animated fadeIn">
        <p className="lead">Trace Centrifugo events in real-time</p>
        <form ref={this.formRef} method="POST" action="" onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            Choose what to trace
            <select className="form-control" ref={this.methodRef} name="method" id="method" onChange={this.handleMethodChange.bind(this)}>
              <option value="user">Trace User</option>
              <option value="channel">Trace Channel</option>
            </select>
          </div>
          {paramsForm}
          <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">{buttonText}</button>
          <button type="button" ref={this.cancelRef} disabled={false} className="btn btn-secondary d-none">Cancel</button>
          <span id="errorBox" className={errorClasses}>{errorMessage}</span>
          <span className={loaderClasses}>
            <div className="loading">
              <div className="loading-bar" />
              <div className="loading-bar" />
              <div className="loading-bar" />
              <div className="loading-bar" />
            </div>
          </span>
        </form>
        {/* https://github.com/mac-s-g/react-json-view ? */}
        <div className="trace-area">
          {messageLog}
        </div>
      </main>
    );
  }
}

TracingPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
};

class ChannelForm extends React.Component {
  constructor() {
    super();
    this.onChannelChange = this.onChannelChange.bind(this);
    this.state = {
      channel: '',
    };
  }

  onChannelChange(e) {
    this.setState({ channel: e.target.value });
  }

  getEntity() {
    const channel = this.state.channel;
    if (!channel) {
      return { error: 'Empty channel' };
    }
    return {
      entity: channel,
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Channel
          <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
        </div>
      </div>
    );
  }
}

class UserForm extends React.Component {
  constructor() {
    super();
    this.onUserChange = this.onUserChange.bind(this);
    this.state = {
      user: '',
    };
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  getEntity() {
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
    }
    return {
      entity: user,
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          User ID
          <input type="text" onChange={this.onUserChange} autoComplete="off" className="form-control" name="user" id="user" />
        </div>
      </div>
    );
  }
}
