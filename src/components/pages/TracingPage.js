// eslint-disable-next-line max-classes-per-file
import React from 'react';
import PropTypes from 'prop-types';
import { RandomString } from '../functions/Functions';

const classNames = require('classnames');
const $ = require('jquery');

function getURL(traceType, traceEntity) {
  const proto = window.location.protocol.replace('http', 'ws');
  const baseURL = `${proto}//${window.location.host}${window.location.pathname}admin/trace`;
  const urlWithAuth = `${baseURL}?token=${localStorage.getItem('token')}`;
  return `${urlWithAuth}&type=${traceType}&entity=${traceEntity}`;
}

class PrettyPrintJson extends React.Component {
  render() {
    // data could be a prop for example
    const { data } = this.props;
    return (<div><pre>{JSON.stringify(data, null, 2) }</pre></div>);
  }
}

PrettyPrintJson.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  data: PropTypes.any.isRequired,
};

// eslint-disable-next-line react/prefer-stateless-function
export default class TracingPage extends React.Component {
  constructor() {
    super();
    this.formRef = React.createRef();
    this.methodRef = React.createRef();
    this.submitRef = React.createRef();
    this.cancelRef = React.createRef();
    this.messages = [];
    this.state = {
      method: 'user',
      running: false,
      messages: [],
    };
    this.fields = ['channel', 'user'];
    this.methodFields = {
      publication: ['channel'],
      user: ['user'],
    };
    this.ws = null;
  }

  componentDidMount() {
    this.handleMethodChange();
  }

  componentWillUnmount() {
    this.stopWS();
    clearInterval(this.interval);
  }

  startWS(method, traceEntity) {
    this.ws = new WebSocket(getURL(method, traceEntity));
    const handleMessage = (event) => {
      this.messages.unshift({
        json: JSON.parse(event.data),
        time: new Date().toLocaleTimeString(),
      });
      this.messages = this.messages.slice(0, 100);
    };
    const handleClose = () => {
      this.stopWS();
    };
    this.ws.onmessage = handleMessage;
    this.ws.onclose = handleClose;
    this.setState({
      running: true,
      method,
      messages: [],
    });
    this.interval = setInterval(() => {
      this.setState({ messages: this.messages });
    }, 1000);
  }

  stopWS() {
    if (this.ws != null) {
      this.ws.close();
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
    const fieldsToShow = this.methodFields[method];
    Object.keys(fieldsToShow).forEach((key) => {
      const field = $(`#${fieldsToShow[key]}`);
      field.attr('disabled', false).parents('.form-group:first').show();
    });
    Object.keys(this.fields).forEach((key) => {
      const fieldName = this.fields[key];
      if (fieldsToShow.indexOf(fieldName) === -1) {
        $(`#${fieldName}`).attr('disabled', true).parents('.form-group:first').hide();
      }
    });
  }

  handleSubmit(e) {
    e.preventDefault();
    const { running } = this.state;
    if (running) {
      this.stopWS();
      return;
    }
    const method = this.methodRef.current.value;
    let traceEntity;
    if (method === 'publication') {
      const field = $('#channel');
      traceEntity = field.val();
    } else if (method === 'user') {
      const field = $('#user');
      traceEntity = field.val();
    }
    this.startWS(method, traceEntity);
  }

  render() {
    const { messages, running, method } = this.state;
    const loaderClasses = classNames({ 'trace-loader': true, 'd-none': !running });
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
            &nbsp;
            <span className="trace-row-elem">User</span>
            :&nbsp;
            <span className="trace-row-value">{message.json.user}</span>
            ,&nbsp;
            <span className="trace-row-elem">Client</span>
            :&nbsp;
            <span className="trace-row-value">{message.json.client}</span>
            ,&nbsp;
            <span className="trace-row-elem">Type</span>
            :&nbsp;
            <span className="trace-row-value">{message.json.type}</span>
          </div>
          <PrettyPrintJson data={message.json} />
        </div>
      ));
    } else if (method === 'publication') {
      messageLog = messages.map((message) => {
        const serverPublication = message.json.client === '';
        let span;
        if (serverPublication) {
          span = null;
        } else {
          span = (
            <span>
              <span className="trace-row-elem">User</span>
              :&nbsp;
              <span className="trace-row-value">{message.json.user}</span>
              ,&nbsp;
              <span className="trace-row-elem">Client</span>
              :&nbsp;
              <span className="trace-row-value">{message.json.client}</span>
            </span>
          );
        }
        return (
          <div key={RandomString(16)} className="trace-row">
            <div className="trace-row-header">
              <span className="trace-row-time">{message.time}</span>
              &nbsp;
              {span}
            </div>
            <PrettyPrintJson data={message.json} />
          </div>
        );
      });
    }

    return (
      <main className="p-3 animated fadeIn">
        <p className="lead">Trace Centrifugo events in real-time</p>
        <form ref={this.formRef} method="POST" action="" onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            Choose what to trace
            <select className="form-control" ref={this.methodRef} name="method" id="method" onChange={this.handleMethodChange.bind(this)}>
              <option value="user">User events</option>
              <option value="publication">Channel Publications</option>
            </select>
          </div>
          <div className="form-group">
            Channel
            <input type="text" autoComplete="off" className="form-control" name="channel" id="channel" />
          </div>
          <div className="form-group">
            User ID
            <input type="text" autoComplete="off" className="form-control" name="user" id="user" />
          </div>
          <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">{buttonText}</button>
          <button type="button" ref={this.cancelRef} disabled={false} className="btn btn-secondary d-none">Cancel</button>
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
