import React from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import { PrettifyJson } from '../functions/Functions';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-monokai';

const classNames = require('classnames');

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
      error: '',
      success: false,
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
        this.setState({ error: actionResponse.error.message });
      } else {
        this.setState({ success: true });
      }
    }
  }

  handleMethodChange() {
    const method = this.methodRef.current.value;
    if (!method) {
      return;
    }
    this.setState({
      method,
      error: '',
      success: false,
    });
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({ success: false });
    const method = this.methodRef.current.value;
    let params;
    if (this.paramsRef.current) {
      const result = this.paramsRef.current.getParams();
      if (result.error) {
        this.setState({ error: result.error });
        return;
      }
      params = result.params;
    } else {
      params = {};
    }

    const { sendAction } = this.props;
    const uid = sendAction(method, params);
    this.setState({
      error: '',
      success: false,
      loading: true,
      uid,
    });
  }

  render() {
    const { loading, actionRequest, actionResponse } = this.props;
    const loaderClasses = classNames({ 'd-none': !loading });
    const request = actionRequest ? PrettifyJson(actionRequest) : '';
    const response = actionResponse ? PrettifyJson(actionResponse) : '';
    const requestLabelClasses = classNames({ 'action-label': true, 'd-none': actionRequest == null });
    const responseLabelClasses = classNames({ 'action-label': true, 'd-none': actionResponse == null });
    const errorClasses = classNames({ 'd-none': this.state.error === '', box: true, 'box-error': true });
    const successClasses = classNames({ 'd-none': this.state.success === false, box: true, 'box-success': true });

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
    } else if (method === 'refresh') {
      paramsForm = <RefreshForm ref={this.paramsRef} />;
    } else if (method === 'channels') {
      paramsForm = <ChannelsForm ref={this.paramsRef} />;
    } else if (method === 'update_user_status') {
      paramsForm = <UpdateUserStatusForm ref={this.paramsRef} />;
    } else if (method === 'get_user_status') {
      paramsForm = <GetUserStatusForm ref={this.paramsRef} />;
    } else if (method === 'delete_user_status') {
      paramsForm = <DeleteUserStatusForm ref={this.paramsRef} />;
    } else if (method === 'user_connections') {
      paramsForm = <UserConnectionsForm ref={this.paramsRef} />;
    } else if (method === 'block_user') {
      paramsForm = <BlockUserForm ref={this.paramsRef} />;
    } else if (method === 'unblock_user') {
      paramsForm = <UnblockUserForm ref={this.paramsRef} />;
    } else if (method === 'revoke_token') {
      paramsForm = <RevokeTokenForm ref={this.paramsRef} />;
    } else if (method === 'invalidate_user_tokens') {
      paramsForm = <InvalidateUserTokensForm ref={this.paramsRef} />;
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
              <option value="refresh">refresh</option>
              <option value="info">info</option>
              <option value="rpc">rpc</option>
              <option value="channels">channels</option>
              <option disabled>---PRO methods---</option>
              <option value="user_connections">user connections</option>
              <option value="update_user_status">update user status</option>
              <option value="get_user_status">get user status</option>
              <option value="delete_user_status">delete user status</option>
              <option value="block_user">block user</option>
              <option value="unblock_user">unblock user</option>
              <option value="revoke_token">revoke token</option>
              <option value="invalidate_user_tokens">invalidate user tokens</option>
            </select>
          </div>
          {paramsForm}
          <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">Submit</button>
          <span id="errorBox" className={errorClasses}>{this.state.error}</span>
          <span id="successBox" className={successClasses}>Success</span>
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
      return { error: 'Empty channel' };
    }
    let dataJSON;
    try {
      dataJSON = JSON.parse(data);
    } catch (e) {
      return { error: 'Invalid data JSON' };
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
      return { error: 'Invalid data JSON' };
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
      return { error: 'Empty channel' };
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
      return { error: 'Empty channel' };
    }
    let limit;
    try {
      limit = parseInt(this.state.limit, 10);
    } catch (e) {
      return { error: 'Malformed limit' };
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
      return { error: 'Invalid data JSON' };
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
      return { error: 'Empty channel' };
    }
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
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
      return { error: 'Empty channel' };
    }
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
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
      return { error: 'Empty user ID' };
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

class RefreshForm extends React.Component {
  constructor() {
    super();
    this.onUserChange = this.onUserChange.bind(this);
    this.onExpireAtChange = this.onExpireAtChange.bind(this);
    this.onClientChange = this.onClientChange.bind(this);
    this.state = {
      user: '',
      expireAt: 0,
      client: '',
    };
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  onExpireAtChange(e) {
    this.setState({ expireAt: e.target.value });
  }

  onClientChange(e) {
    this.setState({ client: e.target.value });
  }

  getParams() {
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
    }
    const expireAt = parseInt(this.state.expireAt, 10);
    if (!Number.isInteger(expireAt)) {
      return { error: 'Invalid expire at value' };
    }
    const client = this.state.client;
    return {
      params: {
        user,
        expire_at: expireAt,
        client,
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
        <div className="form-group">
          Expire At (Unix seconds, zero value means no expiration)
          <input type="text" onChange={this.onExpireAtChange} autoComplete="off" className="form-control" name="expire_at" id="expire_at" />
        </div>
        <div className="form-group">
          Client
          <input type="text" onChange={this.onClientChange} autoComplete="off" className="form-control" name="client" id="client" />
        </div>
      </div>
    );
  }
}

class ChannelsForm extends React.Component {
  constructor() {
    super();
    this.onPatternChange = this.onPatternChange.bind(this);
    this.state = {
      pattern: '',
    };
  }

  onPatternChange(e) {
    this.setState({ pattern: e.target.value });
  }

  getParams() {
    const pattern = this.state.pattern;
    return {
      params: {
        pattern,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Pattern
          <input type="text" onChange={this.onPatternChange} autoComplete="off" className="form-control" name="pattern" id="pattern" />
        </div>
      </div>
    );
  }
}

class UpdateUserStatusForm extends React.Component {
  constructor() {
    super();
    this.onUsersChange = this.onUsersChange.bind(this);
    this.state = {
      users: [],
    };
  }

  onUsersChange(e) {
    this.setState({ users: e.target.value.split(' ') });
  }

  getParams() {
    const users = this.state.users;
    return {
      params: {
        users,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Users (SPACE separated)
          <input type="text" onChange={this.onUsersChange} autoComplete="off" className="form-control" name="users" id="users" />
        </div>
      </div>
    );
  }
}

class GetUserStatusForm extends React.Component {
  constructor() {
    super();
    this.onUsersChange = this.onUsersChange.bind(this);
    this.state = {
      users: [],
    };
  }

  onUsersChange(e) {
    this.setState({ users: e.target.value.split(' ') });
  }

  getParams() {
    const users = this.state.users;
    return {
      params: {
        users,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Users (SPACE separated)
          <input type="text" onChange={this.onUsersChange} autoComplete="off" className="form-control" name="users" id="users" />
        </div>
      </div>
    );
  }
}

class DeleteUserStatusForm extends React.Component {
  constructor() {
    super();
    this.onUsersChange = this.onUsersChange.bind(this);
    this.state = {
      users: [],
    };
  }

  onUsersChange(e) {
    this.setState({ users: e.target.value.split(' ') });
  }

  getParams() {
    const users = this.state.users;
    return {
      params: {
        users,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Users (SPACE separated)
          <input type="text" onChange={this.onUsersChange} autoComplete="off" className="form-control" name="users" id="users" />
        </div>
      </div>
    );
  }
}

class UserConnectionsForm extends React.Component {
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
      return { error: 'Empty user ID' };
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

class BlockUserForm extends React.Component {
  constructor() {
    super();
    this.onUserChange = this.onUserChange.bind(this);
    this.onExpireAtChange = this.onExpireAtChange.bind(this);
    this.state = {
      user: '',
      expireAt: 0,
    };
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  onExpireAtChange(e) {
    this.setState({ expireAt: e.target.value });
  }

  getParams() {
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
    }
    let expireAt;
    try {
      expireAt = parseInt(this.state.expireAt, 10);
    } catch (e) {
      return { error: 'Malformed expire_at' };
    }
    return {
      params: {
        user,
        expire_at: expireAt,
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
        <div className="form-group">
          Expire entry at (Unix seconds, zero value means no expiration and not recommended)
          <input type="text" onChange={this.onExpireAtChange} autoComplete="off" className="form-control" name="expire_at" id="expire_at" />
        </div>
      </div>
    );
  }
}

class UnblockUserForm extends React.Component {
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
      return { error: 'Empty user ID' };
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

class RevokeTokenForm extends React.Component {
  constructor() {
    super();
    this.onUidChange = this.onUidChange.bind(this);
    this.onExpireAtChange = this.onExpireAtChange.bind(this);
    this.state = {
      uid: '',
      expireAt: 0,
    };
  }

  onUidChange(e) {
    this.setState({ uid: e.target.value });
  }

  onExpireAtChange(e) {
    this.setState({ expireAt: e.target.value });
  }

  getParams() {
    const uid = this.state.uid;
    if (!uid) {
      return { error: 'Empty token UID' };
    }
    let expireAt;
    try {
      expireAt = parseInt(this.state.expireAt, 10);
    } catch (e) {
      return { error: 'Malformed expire_at' };
    }
    return {
      params: {
        uid,
        expire_at: expireAt,
      },
    };
  }

  render() {
    return (
      <div>
        <div className="form-group">
          Token ID (JTI)
          <input type="text" onChange={this.onUidChange} autoComplete="off" className="form-control" name="uid" id="uid" />
        </div>
        <div className="form-group">
          Expire entry at (Unix seconds, zero value means no expiration and not recommended)
          <input type="text" onChange={this.onExpireAtChange} autoComplete="off" className="form-control" name="expire_at" id="expire_at" />
        </div>
      </div>
    );
  }
}

class InvalidateUserTokensForm extends React.Component {
  constructor() {
    super();
    this.onUserChange = this.onUserChange.bind(this);
    this.onIssuedBeforeChange = this.onIssuedBeforeChange.bind(this);
    this.onExpireAtChange = this.onExpireAtChange.bind(this);
    this.state = {
      user: '',
      issuedBefore: Math.round((new Date()).getTime() / 1000),
      expireAt: 0,
    };
  }

  onUserChange(e) {
    this.setState({ user: e.target.value });
  }

  onIssuedBeforeChange(e) {
    this.setState({ issuedBefore: e.target.value });
  }

  onExpireAtChange(e) {
    this.setState({ expireAt: e.target.value });
  }

  getParams() {
    const user = this.state.user;
    if (!user) {
      return { error: 'Empty user ID' };
    }
    let issuedBefore;
    try {
      issuedBefore = parseInt(this.state.issuedBefore, 10);
    } catch (e) {
      return { error: 'Malformed issued_before' };
    }
    let expireAt;
    try {
      expireAt = parseInt(this.state.expireAt, 10);
    } catch (e) {
      return { error: 'Malformed expire_at' };
    }
    return {
      params: {
        user,
        issued_before: issuedBefore,
        expire_at: expireAt,
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
        <div className="form-group">
          All tokens issued before (Unix seconds)
          <input type="text" onChange={this.onIssuedBeforeChange} autoComplete="off" className="form-control" name="issued_before" id="issued_before" value={this.state.issuedBefore} />
        </div>
        <div className="form-group">
          Expire entry at (Unix seconds, zero value means no expiration and not recommended)
          <input type="text" onChange={this.onExpireAtChange} autoComplete="off" className="form-control" name="expire_at" id="expire_at" />
        </div>
      </div>
    );
  }
}
