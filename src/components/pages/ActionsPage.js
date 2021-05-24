import React from 'react';
import PropTypes from 'prop-types';
import { PrettifyJson } from '../functions/Functions';

const classNames = require('classnames');
const $ = require('jquery');

const ace = require('brace');
require('brace/mode/json');
require('brace/theme/monokai');

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
    this.dataEditorRef = React.createRef();
    this.submitRef = React.createRef();
    this.requestRef = React.createRef();
    this.responseRef = React.createRef();

    this.state = {
      loading: false,
      uid: '',
    };

    this.editor = null;

    this.fields = ['channel', 'channels', 'data', 'user', 'rpc_method'];

    this.methodFields = {
      publish: ['channel', 'data'],
      broadcast: ['channels', 'data'],
      presence: ['channel'],
      presence_stats: ['channel'],
      history: ['channel'],
      history_remove: ['channel'],
      subscribe: ['channel', 'user', 'data'],
      unsubscribe: ['channel', 'user'],
      disconnect: ['user'],
      channels: [],
      info: [],
      rpc: ['rpc_method', 'data'],
    };
  }

  componentDidMount() {
    this.editor = ace.edit('data-editor');
    this.editor.getSession().setMode('ace/mode/json');
    this.editor.setTheme('ace/theme/monokai');
    this.editor.setShowPrintMargin(false);
    this.editor.getSession().setUseSoftTabs(true);
    this.editor.getSession().setUseWrapMode(true);

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
    const method = this.methodRef.current.value;
    let jsonData;
    let json;
    if (method === 'publish' || method === 'broadcast' || method === 'rpc' || method === 'subscribe') {
      jsonData = this.editor.getSession().getValue();
      if (jsonData.length === 0 && (method === 'publish' || method === 'broadcast' || method === 'rpc')) {
        showError('JSON data required');
        return;
      }
      if (jsonData.length > 0) {
        try {
          json = JSON.stringify(JSON.parse(jsonData));
        } catch (err) {
          showError('malformed JSON');
          return;
        }
      }
    }
    this.dataEditorRef.current.value = json;
    const fieldsForParams = this.methodFields[method];
    const params = {};
    Object.keys(fieldsForParams).forEach((key) => {
      const field = $(`#${fieldsForParams[key]}`);
      let paramsKey = fieldsForParams[key];
      if (paramsKey === 'rpc_method') {
        paramsKey = 'method';
      }
      params[paramsKey] = field.val();
    });
    delete params.data;
    if ((method === 'publish' || method === 'subscribe') && params.channel === '') {
      showError('channel required');
      return;
    }
    if ((method === 'subscribe') && params.user === '') {
      showError('user required');
      return;
    }
    if (method === 'publish' || method === 'broadcast') {
      // publish, broadcast are somewhat special as they have raw JSON in data.
      params.data = JSON.parse(jsonData);
    }
    if (method === 'rpc') {
      params.params = JSON.parse(jsonData);
    }
    if (method === 'subscribe' && jsonData.length > 0) {
      params.data = JSON.parse(jsonData);
    }
    if (method === 'broadcast') {
      // convert space separated channels to array of channels.
      params.channels = $('#channels').val().split(' ');
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
              <option value="channels">channels</option>
              <option value="info">info</option>
              <option value="rpc">rpc</option>
            </select>
          </div>
          <div className="form-group">
            Channel
            <input type="text" autoComplete="off" className="form-control" name="channel" id="channel" />
          </div>
          <div className="form-group">
            Channels (SPACE separated)
            <input type="text" autoComplete="off" className="form-control" name="channels" id="channels" />
          </div>
          <div className="form-group">
            User ID
            <input type="text" autoComplete="off" className="form-control" name="user" id="user" />
          </div>
          <div className="form-group">
            RPC method name
            <input type="text" autoComplete="off" className="form-control" name="rpc_method" id="rpc_method" />
          </div>
          <div className="form-group">
            Data
            <div id="data-editor" />
            <textarea ref={this.dataEditorRef} className="d-none" id="data" name="data" />
          </div>
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
