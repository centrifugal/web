import React from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import { PrettifyJson } from '../functions/Functions';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-monokai';

const classNames = require('classnames');
const $ = require('jquery');

function hideSuccess() {
  const success = $('#successBox');
  success.addClass('d-none');
}

function hideError() {
  const error = $('#errorBox');
  error.addClass('d-none');
}

function showError(text) {
  const error = $('#errorBox');
  error.text(`Error: ${text}`);
  if (error.hasClass('d-none')) {
    hideSuccess();
    error.stop().hide().removeClass('d-none').fadeIn();
  }
}

function showSuccess() {
  const success = $('#successBox');
  if (success.hasClass('d-none')) {
    hideError();
    success.stop().hide().removeClass('d-none').fadeIn();
  }
}

export default class ActionsPage extends React.Component {
  constructor() {
    super();
    this.formRef = React.createRef();
    this.methodRef = React.createRef();
    this.submitRef = React.createRef();
    this.requestRef = React.createRef();
    this.responseRef = React.createRef();
    this.paramsRef = React.createRef();

    this.state = {
      method: 'publish',
      loading: false,
      uid: '',
    };
  }

  componentDidMount() {
    this.handleMethodChange();
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps) {
    const { uid, loading } = this.state;
    const { actionResponse } = nextProps;
    if (actionResponse && loading && uid === actionResponse.uid) {
      this.setState({ loading: false, uid: '' });
      if (actionResponse.error) {
        showError(actionResponse.error.message);
      } else {
        showSuccess();
      }
    }
  }

  handleMethodChange() {
    const method = this.methodRef.current.value;
    if (!method) {
      return;
    }
    this.setState({ method });
  }

  handleSubmit(e) {
    e.preventDefault();
    const method = this.methodRef.current.value;
    let params;
    if (this.paramsRef.current) {
      const result = this.paramsRef.current.getParams();
      if (result.error) {
        console.log(result.error);
        // this.setState({ error: result.error });
        return;
      }
      params = result.params;
    } else {
      params = {};
    }
    hideError();
    hideSuccess();
    const { sendAction } = this.props;
    const uid = sendAction(method, params);
    this.setState({ loading: true, uid });
  }

  render() {
    const { loading, actionRequest, actionResponse } = this.props;
    const loaderClasses = classNames({ 'd-none': !loading });
    const request = actionRequest ? PrettifyJson(actionRequest) : '';
    const response = actionResponse ? PrettifyJson(actionResponse) : '';
    const requestLabelClasses = classNames({ 'action-label': true, 'd-none': actionRequest == null });
    const responseLabelClasses = classNames({ 'action-label': true, 'd-none': actionResponse == null });

    let paramsForm;
    const { method } = this.state;
    if (method === 'publish') {
      paramsForm = <PublishForm ref={this.paramsRef} />;
    } else if (method === 'broadcast') {
      paramsForm = <BroadcastForm ref={this.paramsRef} />;
    } else if (method === 'rpc') {
      paramsForm = <RpcForm ref={this.paramsRef} />;
    } else if (method === 'presence') {
      paramsForm = <ChannelOnlyForm ref={this.paramsRef} />;
    } else if (method === 'presence_stats') {
      paramsForm = <ChannelOnlyForm ref={this.paramsRef} />;
    } else if (method === 'history') {
      paramsForm = <HistoryForm ref={this.paramsRef} />;
    } else if (method === 'history_remove') {
      paramsForm = <ChannelOnlyForm ref={this.paramsRef} />;
    } else if (method === 'subscribe') {
      paramsForm = <SubscribeForm ref={this.paramsRef} />;
    } else if (method === 'unsubscribe') {
      paramsForm = <UnsubscribeForm ref={this.paramsRef} />;
    } else if (method === 'disconnect') {
      paramsForm = <DisconnectForm ref={this.paramsRef} />;
    }

    return (
      <main className="p-3 animated fadeIn">
        <p className="lead">Execute command on server</p>

        <form ref={this.formRef} method="POST" action="" onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            Method
            <select className="form-control" ref={this.methodRef} name="method" id="method" onChange={this.handleMethodChange.bind(this)}>
              <option value="publish">publish</option>
              <option value="broadcast">broadcast</option>
              <option value="presence">presence</option>
              <option value="presence_stats">presence stats</option>
              <option value="history">history</option>
              <option value="history_remove">history remove</option>
              <option value="subscribe">subscribe</option>
              <option value="unsubscribe">unsubscribe</option>
              <option value="disconnect">disconnect</option>
              <option value="info">info</option>
              <option value="rpc">rpc</option>
            </select>
          </div>
          {paramsForm}
          <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">Submit</button>
          <span id="errorBox" className="box box-error d-none">Error</span>
          <span id="successBox" className="box box-success d-none">Success</span>
        </form>
        <div className="action-request">
          <div className="action-label-container">
            <span className={requestLabelClasses}>Request:</span>
          </div>
          <pre ref={this.requestRef} dangerouslySetInnerHTML={{ __html: request }} />
        </div>
        <div className="action-response">
          <div className="action-label-container">
            <span className={responseLabelClasses}>Response:</span>
            <span className={loaderClasses}>
              <div className="loading">
                <div className="loading-bar" />
                <div className="loading-bar" />
                <div className="loading-bar" />
                <div className="loading-bar" />
              </div>
            </span>
          </div>
          <pre ref={this.responseRef} dangerouslySetInnerHTML={{ __html: response }} />
        </div>
      </main>
    );
  }
}

ActionsPage.defaultProps = {
  actionRequest: null,
  actionResponse: null,
};

ActionsPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  actionRequest: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  actionResponse: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  sendAction: PropTypes.func.isRequired,
};

function onLoadFunction(editor) {
  editor.renderer.setPadding(10);
  editor.renderer.setScrollMargin(10);
}

class PublishForm extends React.Component {
  constructor() {
    super();
    this.onChannelChange = this.onChannelChange.bind(this);
    this.onDataChange = this.onDataChange.bind(this);
    this.state = {
      channel: '',
      data: '',
    };
  }

  onChannelChange(e) {
    this.setState({ channel: e.target.value });
  }

  onDataChange(value) {
    this.setState({ data: value });
  }

  getParams() {
    const channel = this.state.channel;
    const data = this.state.data;
    if (!channel) {
      return { error: 'empty channel' };
    }
    let dataJSON;
    try {
      dataJSON = JSON.parse(data);
    } catch (e) {
      return { error: 'malformed data JSON' };
    }
    return {
      params: {
        channel,
        data: dataJSON,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Channel
          <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
        </div>
        <div className="form-group">
          Data
          <AceEditor
            mode="json"
            theme="monokai"
            onChange={this.onDataChange}
            name="data-editor-publish"
            editorProps={{ $blockScrolling: true }}
            width="100%"
            height="300px"
            showGutter={false}
            onLoad={onLoadFunction}
            setOptions={{ useWorker: false }}
          />
        </div>
      </div>
    );
  }
}

class BroadcastForm extends React.Component {
  constructor() {
    super();
    this.onChannelsChange = this.onChannelsChange.bind(this);
    this.onDataChange = this.onDataChange.bind(this);
    this.state = {
      channels: [],
      data: '',
    };
  }

  onChannelsChange(e) {
    this.setState({ channels: e.target.value.split(' ') });
  }

  onDataChange(value) {
    this.setState({ data: value });
  }

  getParams() {
    const channels = this.state.channels;
    const data = this.state.data;
    if (channels.length === 0) {
      return { error: 'empty channels' };
    }
    let dataJSON;
    try {
      dataJSON = JSON.parse(data);
    } catch (e) {
      return { error: 'malformed data JSON' };
    }
    return {
      params: {
        channels,
        data: dataJSON,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
            Channels (SPACE separated)
          <input type="text" onChange={this.onChannelsChange} autoComplete="off" className="form-control" name="channels" id="channels" />
        </div>
        <div className="form-group">
            Data
          <AceEditor
            mode="json"
            theme="monokai"
            onChange={this.onDataChange}
            name="data-editor-publish"
            editorProps={{ $blockScrolling: true }}
            width="100%"
            height="300px"
            showGutter={false}
            onLoad={onLoadFunction}
            setOptions={{ useWorker: false }}
          />
        </div>
      </div>
    );
  }
}

class ChannelOnlyForm extends React.Component {
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

  getParams() {
    const channel = this.state.channel;
    if (!channel) {
      return { error: 'empty channel' };
    }
    return {
      params: {
        channel,
      },
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

class HistoryForm extends React.Component {
  constructor() {
    super();
    this.onChannelChange = this.onChannelChange.bind(this);
    this.onLimitChange = this.onLimitChange.bind(this);
    // this.onReverseChange = this.onReverseChange.bind(this);
    this.state = {
      channel: '',
      limit: 0,
      // reverse: false,
    };
  }

  onChannelChange(e) {
    this.setState({ channel: e.target.value });
  }

  onLimitChange(e) {
    this.setState({ limit: e.target.value });
  }

  // onReverseChange() {
  //   this.setState({ reverse: !this.state.reverse });
  // }

  getParams() {
    const channel = this.state.channel;
    if (!channel) {
      return { error: 'empty channel' };
    }
    let limit;
    try {
      limit = parseInt(this.state.limit, 10);
    } catch (e) {
      return { error: 'malformed limit' };
    }
    // const reverse = this.state.reverse;
    return {
      params: {
        channel,
        limit,
        // reverse
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Channel
          <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
        </div>
        <div className="form-group">
          Limit
          <input type="text" onChange={this.onLimitChange} value={this.state.limit} autoComplete="off" className="form-control" name="limit" id="limit" />
        </div>
        {/* <div className="form-group">
          Reverse
          <input type="checkbox" onChange={this.onReverseChange} checked={this.state.reverse} className="form-control" name="reverse" id="reverse" />
        </div> */}
      </div>
    );
  }
}

class RpcForm extends React.Component {
  constructor() {
    super();
    this.onMethodChange = this.onMethodChange.bind(this);
    this.onParamsChange = this.onParamsChange.bind(this);
    this.state = {
      method: '',
      params: '',
    };
  }

  onMethodChange(e) {
    this.setState({ method: e.target.value });
  }

  onParamsChange(value) {
    this.setState({ params: value });
  }

  getParams() {
    const method = this.state.method;
    const params = this.state.params;
    let paramsJSON;
    try {
      paramsJSON = JSON.parse(params);
    } catch (e) {
      return { error: 'malformed data JSON' };
    }
    return {
      params: {
        method,
        params: paramsJSON,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Method
          <input type="text" onChange={this.onMethodChange} autoComplete="off" className="form-control" name="method" id="method" />
        </div>
        <div className="form-group">
          Params
          <AceEditor
            mode="json"
            theme="monokai"
            onChange={this.onParamsChange}
            name="data-editor-publish"
            editorProps={{ $blockScrolling: true }}
            width="100%"
            height="300px"
            showGutter={false}
            onLoad={onLoadFunction}
            setOptions={{ useWorker: false }}
          />
        </div>
      </div>
    );
  }
}

class SubscribeForm extends React.Component {
  constructor() {
    super();
    this.onChannelChange = this.onChannelChange.bind(this);
    this.onUserChange = this.onUserChange.bind(this);
    this.state = {
      channel: '',
      user: '',
    };
  }

  onChannelChange(e) {
    this.setState({ channel: e.target.value });
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  getParams() {
    const channel = this.state.channel;
    if (!channel) {
      return { error: 'empty channel' };
    }
    const user = this.state.user;
    if (!user) {
      return { error: 'empty user ID' };
    }
    return {
      params: {
        channel,
        user,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Channel
          <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
        </div>
        <div className="form-group">
          User ID
          <input type="text" onChange={this.onUserChange} autoComplete="off" className="form-control" name="user" id="user" />
        </div>
      </div>
    );
  }
}

class UnsubscribeForm extends React.Component {
  constructor() {
    super();
    this.onChannelChange = this.onChannelChange.bind(this);
    this.onUserChange = this.onUserChange.bind(this);
    this.state = {
      channel: '',
      user: '',
    };
  }

  onChannelChange(e) {
    this.setState({ channel: e.target.value });
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  getParams() {
    const channel = this.state.channel;
    if (!channel) {
      return { error: 'empty channel' };
    }
    const user = this.state.user;
    if (!user) {
      return { error: 'empty user ID' };
    }
    return {
      params: {
        channel,
        user,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Channel
          <input type="text" onChange={this.onChannelChange} autoComplete="off" className="form-control" name="channel" id="channel" />
        </div>
        <div className="form-group">
          User ID
          <input type="text" onChange={this.onUserChange} autoComplete="off" className="form-control" name="user" id="user" />
        </div>
      </div>
    );
  }
}

class DisconnectForm extends React.Component {
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

  getParams() {
    const user = this.state.user;
    if (!user) {
      return { error: 'empty user ID' };
    }
    return {
      params: {
        user,
      },
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
