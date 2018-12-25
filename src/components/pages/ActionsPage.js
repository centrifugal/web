import React from 'react';
import PropTypes from 'prop-types';
import {PrettifyJson} from '../functions/Functions';
var classNames = require('classnames');
var $ = require('jquery');

var ace = require('brace');
require('brace/mode/json');
require('brace/theme/monokai');

export class ActionsPage extends React.Component {
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
            uid: ''
        };
    }

    editor = null

    fields = ['channel', 'channels', 'data', 'user']

    methodFields = {
        'publish': ['channel', 'data'],
        'broadcast': ['channels', 'data'],
        'presence': ['channel'],
        'presence_stats': ['channel'],
        'history': ['channel'],
        'history_remove': ['channel'],
        'unsubscribe': ['channel', 'user'],
        'disconnect': ['user'],
        'channels': [],
        'info': []
    }

    handleMethodChange() {
        var method = this.methodRef.current.value;
        if (!method) {
            return;
        }
        var fieldsToShow = this.methodFields[method];
        for (var i in fieldsToShow) {
            var field = $('#' + fieldsToShow[i]);
            field.attr('disabled', false).parents('.form-group:first').show();
        }
        for (var k in this.fields) {
            var field_name = this.fields[k];
            if (fieldsToShow.indexOf(field_name) === -1) {
                $('#' + field_name).attr('disabled', true).parents('.form-group:first').hide();
            }
        }
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

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.dashboard.actionResponse && this.state.loading && this.state.uid === nextProps.dashboard.actionResponse.uid ) {
            this.setState({loading: false, uid: ''});
            if (nextProps.dashboard.actionResponse.error) {
                this.showError(nextProps.dashboard.actionResponse.error.message);
            } else {
                this.showSuccess();
            }
        }
    }

    hideError() {
        var error = $('#errorBox');
        error.addClass('d-none');
    }

    hideSuccess() {
        var success = $('#successBox');
        success.addClass('d-none');
    }

    showError(text) {
        var error = $('#errorBox');
        error.text('Error: ' + text);
        if (error.hasClass('d-none')) {
            this.hideSuccess();
            error.stop().hide().removeClass('d-none').fadeIn();
        }
    }

    showSuccess() {
        var success = $('#successBox');
        if (success.hasClass('d-none')) {
            this.hideError();
            success.stop().hide().removeClass('d-none').fadeIn();
        }
    }

    handleSubmit(e) {
        e.preventDefault();
        var method = this.methodRef.current.value;
        var publishData;
        if (method === 'publish' || method === 'broadcast') {
            publishData = this.editor.getSession().getValue();
            try {
                var json = JSON.stringify(JSON.parse(publishData));
            } catch (e) {
                this.showError('malformed JSON');
                return;
            }
        }
        this.dataEditorRef.current.value = json;
        var fieldsForParams = this.methodFields[method];
        var params = {};
        for (var i in fieldsForParams) {
            var field = $('#' + fieldsForParams[i]);
            params[fieldsForParams[i]] = field.val();
        }
        if (method === 'publish' && params['channel'] === '') {
            this.showError('channel required');
            return;
        }
        if (method === 'publish' || method === 'broadcast') {
            // publish and broadcast are somewhat special as they have raw JSON in data.
            params['data'] = JSON.parse(publishData);
        }
        if (method === 'broadcast') {
            // convert space separated channels to array of channels.
            params['channels'] = $('#channels').val().split(' ');
        }
        this.hideError();
        this.hideSuccess();
        this.setState({loading: true, uid: uid});
        var uid = this.props.sendAction(method, params);
    }

    render() {
        var loaderClasses = classNames({'d-none': !this.state.loading});
        var requestData = this.props.dashboard.actionRequest;
        var responseData = this.props.dashboard.actionResponse;
        var request = requestData?PrettifyJson(requestData):'';
        var response = responseData?PrettifyJson(responseData):'';
        var requestLabelClasses = classNames({'action-label': true, 'd-none': requestData == null});
        var responseLabelClasses = classNames({'action-label': true, 'd-none': responseData == null});

        return(
            <main className="p-3 animated fadeIn">
                <p className="lead">Execute command on server</p>

                <form ref={this.formRef} role="form" method="POST" action="" onSubmit={this.handleSubmit.bind(this)}>
                    <div className="form-group">
                        <label htmlFor="method">Method</label>
                        <select className="form-control" ref={this.methodRef} name="method" id="method" onChange={this.handleMethodChange.bind(this)}>
                            <option value="publish">publish</option>
                            <option value="broadcast">broadcast</option>
                            <option value="presence">presence</option>
                            <option value="presence_stats">presence stats</option>
                            <option value="history">history</option>
                            <option value="history_remove">history remove</option>
                            <option value="unsubscribe">unsubscribe</option>
                            <option value="disconnect">disconnect</option>
                            <option value="channels">channels</option>
                            <option value="info">info</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="channel">Channel</label>
                        <input type="text" className="form-control" name="channel" id="channel" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="channels">Channels (SPACE separated)</label>
                        <input type="text" className="form-control" name="channels" id="channels" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="user">User ID</label>
                        <input type="text" className="form-control" name="user" id="user" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="data">Data</label>
                        <div id="data-editor"></div>
                        <textarea ref={this.dataEditorRef} className="d-none" id="data" name="data"></textarea>
                    </div>
                    <button type="submit" ref={this.submitRef} disabled={false} className="btn btn-primary">Submit</button>
                    <span id="errorBox" className="box box-error d-none">Error</span>
                    <span id="successBox" className="box box-success d-none">Success</span>
                </form>
                <div className="action-request">
                    <div className="action-label-container">
                        <span className={requestLabelClasses}>Request:</span>
                    </div>
                    <pre ref={this.requestRef} dangerouslySetInnerHTML={{'__html': request}} />
                </div>
                <div className="action-response">
                    <div className="action-label-container">
                        <span className={responseLabelClasses}>Response:</span>
                        <span className={loaderClasses}>
                            <div className="loading">
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                            </div>
                        </span>
                    </div>
                    <pre ref={this.responseRef} dangerouslySetInnerHTML={{'__html': response}} />
                </div>
            </main>
        );
    }
}

ActionsPage.propTypes = {
    dashboard: PropTypes.object,
    sendAction: PropTypes.func
};
