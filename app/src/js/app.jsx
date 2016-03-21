var React = require('react'),
    Router = require('react-router'),
    Addons = require('react/addons'),
    $ = require('jquery'),
    DefaultRoute = Router.DefaultRoute,
    Link = Router.Link,
    Route = Router.Route,
    RouteHandler = Router.RouteHandler,
    NotFoundRoute = Router.NotFoundRoute;

var ace = require('brace');
require('brace/mode/json');
require('brace/theme/monokai');

var globalUrlPrefix;
var globalAuthUrl;
var globalSocketUrl;

function prettifyJson(json) {
    return syntaxHighlight(JSON.stringify(json, undefined, 4));
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

var App = React.createClass({
    mixins: [Router.State],
    getInitialState: function () {
        return {
            isAuthenticated: false,
            insecure: false
        }
    },
    componentWillMount: function () {
        var state = {};
        var token = localStorage.getItem("token");
        if (token) {
            state["isAuthenticated"] = true;
        }
        var insecure = localStorage.getItem("insecure");
        if (insecure) {
            state["insecure"] = true;
        }
        this.setState(state);
    },
    handleLogin: function (password, auto) {
        var autoLogin = auto || false;
        $.post(globalAuthUrl, {password: password}, "json").success(function (data) {
            if (autoLogin) {
                console.log("Logged in automatically.");
            }
            localStorage.setItem("token", data.token);
            var insecure = data.token === "insecure";
            if (insecure) {
                localStorage.setItem("insecure", true);
            }
            this.setState({isAuthenticated: true, insecure: insecure});
        }.bind(this)).error(function () {
            $.noop();
        });
    },
    handleLogout: function () {
        delete localStorage.token;
        delete localStorage.insecure;
        this.setState({isAuthenticated: false, insecure: false});
    },
    render: function () {
        if (this.state.isAuthenticated) {
            return (
                <Dashboard handleLogout={this.handleLogout} handleLogout={this.handleLogout} insecure={this.state.insecure} {...this.props} />
            )
        } else {
            return (
                <Login handleLogin={this.handleLogin} {...this.props} />
            )
        }
    }
});

var conn;
var reconnectTimeout;
var stateLoadTimeout;
var pingInterval;
var maxMessageAmount = 50;
var lastUID = 0;
var lastActionUID;

var Dashboard = React.createClass({
    mixins: [Router.State],
    getInitialState: function () {
        var protocol = window.location.protocol;
        var isSecure = protocol === "https:";
        var sockjsProtocol = isSecure ? "https://" : "http://";
        var websocketProtocol = isSecure ? "wss://" : "ws://";
        var sockjsEndpoint = sockjsProtocol + window.location.host + globalUrlPrefix + 'connection';
        var wsEndpoint = websocketProtocol + window.location.host + globalUrlPrefix + 'connection/websocket';
        var apiEndpoint = sockjsProtocol + window.location.host + globalUrlPrefix + 'api/';
        return {
            isConnected: false,
            channelOptions: [],
            namespaces: [],
            structureDict: {},
            version: "",
            secret: "",
            connectionLifetime: 0,
            engine: "",
            nodeName: "",
            nodeCount: "",
            sockjsEndpoint: sockjsEndpoint,
            wsEndpoint: wsEndpoint,
            apiEndpoint: apiEndpoint,
            nodes: {},
            messages: [],
            messageCounter: 0,
            actionRequest: null,
            actionResponse: null
        }
    },
    getServerState: function() {
        if (!this.state.isConnected) {
            return;
        }
        conn.send(JSON.stringify([
            {
                "method": "stats",
                "params": {}
            },
            {
                "method": "info",
                "params": {}
            }
        ]));
        stateLoadTimeout = setTimeout(function(){
            this.getServerState();
        }.bind(this), 5000);
    },
    handleConnect: function (data) {
        if ("error" in data && data.error) {
            console.log(data.error);
            this.props.handleLogout();
            return
        }
        var body = data.body;
        if (body === true) {
            this.setState({isConnected: true});
            pingInterval = setInterval(function() {
                conn.send(JSON.stringify({
                    "method": "ping",
                    "params": {}
                }));
            }.bind(this), 25000);
            // successfully connected, time to ask for server state
            this.getServerState();
        } else {
            this.props.handleLogout();
        }
    },
    handleStats: function(data) {
        if ("error" in data && data.error) {
            console.log(data.error);
            return;
        }
        var stats = data.body.data;
        this.setState({
            nodeCount: Object.keys(stats.nodes).length,
            nodes: stats.nodes
        });
    },
    handleInfo: function(data) {
        if ("error" in data && data.error) {
            console.log(data.error);
            return;
        }
        var info = data.body;
        this.setState({
            version: info.config.version,
            channelOptions: info.config.channel_options,
            namespaces: info.config.namespaces,
            engine: info.engine,
            nodeName: info.config.name,
            secret: info.config.secret,
            connectionLifetime: info.config.connection_lifetime
        });
    },
    handleMessage: function (data) {
        if ("error" in data && data.error) {
            console.log(data.error);
            return;
        }
        var message = data.body;
        var currentMessages = this.state.messages.slice();
        var d = new Date();
        message['time'] = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        currentMessages.unshift(message);
        // splice array to keep max message amount
        currentMessages = currentMessages.splice(0, maxMessageAmount);
        this.setState({messages: currentMessages});
        var name = this.getRoutes().reverse()[0].name;
        var isMessagesOpen = name === "messages";
        if (!isMessagesOpen) {
            var currentCounter = this.state.messageCounter;
            this.setState({messageCounter: currentCounter + 1});
        }
    },
    sendAction: function(method, params) {
        if (!this.state.isConnected) {
            return;
        }
        var uid = (++lastUID).toString();
        lastActionUID = uid;
        cmd = {
            uid: uid,
            method: method,
            params: params
        };
        conn.send(JSON.stringify(cmd));
        this.setState({actionRequest: cmd});
        return uid;
    },
    dispatchMessage: function(data) {
        var method = data.method;
        if (data.uid && data.uid === lastActionUID) {
            // At moment only commands that were sent from Actions tab contain unique
            // id in request, so if we got response with uid set then we consider this
            // response as action response.
            this.setState({actionResponse: data});
            return;
        }
        if (method === "connect") {
            this.handleConnect(data);
        } else if (method === "message") {
            this.handleMessage(data);
        } else if (method === "stats") {
            this.handleStats(data);
        } else if (method === "info") {
            this.handleInfo(data);
        } else if (method === "ping") {
            $.noop();
        } else {
            console.log("Got message with unknown method " + method);
        }
    },
    connectWs: function () {
        var protocol = window.location.protocol;
        var isSecure = protocol === "https:";
        var websocketProtocol = isSecure ? "wss://" : "ws://";
        conn = new WebSocket(websocketProtocol + window.location.host + globalSocketUrl);
        conn.onopen = function () {
            conn.send(JSON.stringify({
                "method": "connect",
                "params": {
                    "token": localStorage.getItem("token"),
                    "watch": true
                }
            }));
        }.bind(this);
        conn.onmessage = function (event) {
            var data = JSON.parse(event.data);
            if (Object.prototype.toString.call(data) === Object.prototype.toString.call([])) {
                // array of response objects received
                for (var i in data) {
                    if (data.hasOwnProperty(i)) {
                        var msg = data[i];
                        this.dispatchMessage(msg);
                    }
                }
            } else if (Object.prototype.toString.call(data) === Object.prototype.toString.call({})) {
                // one response object received
                this.dispatchMessage(data);
            }
        }.bind(this);
        conn.onerror = function () {
            this.setState({isConnected: false});
        }.bind(this);
        conn.onclose = function () {
            if (this.isMounted()) {
                this.setState({isConnected: false});
                reconnectTimeout = setTimeout(function () {
                    this.connectWs();
                }.bind(this), 3000);
            }
            if (pingInterval) {
                clearInterval(pingInterval);
            }
            if (stateLoadTimeout) {
                clearTimeout(stateLoadTimeout);
            }
        }.bind(this);
    },
    clearMessageCounter: function () {
        this.setState({messageCounter: 0});
    },
    componentDidMount: function () {
        this.connectWs();
    },
    componentWillUnmount: function () {
        if (conn) {
            conn.close();
            conn = null;
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
        if (stateLoadTimeout) {
            clearTimeout(stateLoadTimeout)
        }
    },
    render: function () {
        return (
            <div>
                <Nav handleLogout={this.props.handleLogout} insecure={this.props.insecure} />
                <div className="wrapper">
                    <Sidebar messageCounter={this.state.messageCounter} />
                    <div className="col-lg-10 col-md-10 col-sm-12 col-xs-12">
                        <ConnectionStatus isConnected={this.state.isConnected} />
                        <RouteHandler
                            dashboard={this.state}
                            handleLogout={this.props.handleLogout}
                            sendAction={this.sendAction}
                            clearMessageCounter={this.clearMessageCounter}
                        {...this.props} />
                    </div>
                </div>
            </div>
        )
    }
});

var Login = React.createClass({
    getInitialState: function() {
        return {
            'focus': false
        }
    },
    componentDidMount: function () {
        // try to login with empty password – maybe insecure_web option enabled in Centrifugo.
        this.props.handleLogin("", true);
    },
    handleSubmit: function (e) {
        e.preventDefault();
        var password = this.refs.password.getDOMNode().value;
        this.props.handleLogin(password);
    },
    inputFocus: function() {
        this.setState({'focus': true});
    },
    inputBlur: function() {
        this.setState({'focus': false});
    },
    render: function () {
        var cx = Addons.addons.classSet;
        var isFocus = this.state['focus'];
        var loginClasses = cx({'login': true, 'login-focus': isFocus});        
        return (
            <div className={loginClasses}>
                <a href="https://github.com/centrifugal" target="_blank">
                    <img className="login-forkme" src="https://camo.githubusercontent.com/38ef81f8aca64bb9a64448d0d70f1308ef5341ab/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f72696768745f6461726b626c75655f3132313632312e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png" />
                </a>
                <div className="login-body">
                    <div className="container">
                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="login-logo">
                                    <div className="spin">
                                        <div className="login-logo-outer"></div>
                                        <div className="login-logo-inner"></div>
                                    </div>
                                </div>
                                <h1 className="login-heading">Centrifugo</h1>
                                <p className="login-text">Real-time messaging</p>
                                <form action="" method="post" className="login-form" onSubmit={this.handleSubmit}>
                                    <div className="form-group">
                                        <input ref="password" onFocus={this.inputFocus} onBlur={this.inputBlur} autoComplete="new-password" className="form-control" type="password" name="password" placeholder="Type password to log in..."/>
                                    </div>
                                    <button type="submit" onFocus={this.inputFocus} onBlur={this.inputBlur} className="btn btn-success login-submit">Log In <i className="glyphicon glyphicon-log-in"></i></button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
});

var Nav = React.createClass({
    handleLogout: function (e) {
        e.preventDefault();
        this.props.handleLogout();
    },
    render: function () {
        var cx = Addons.addons.classSet;
        var logoutClasses = cx({'hidden': this.props.insecure});
        return (
            <nav className="navbar navbar-inverse" role="navigation">
                <div className="navbar-header">
                    <button data-target=".navbar-ex8-collapse" data-toggle="collapse" className="navbar-toggle" type="button">
                        <span className="sr-only">Toggle navigation</span>
                        <span className="icon-bar"></span>
                        <span className="icon-bar"></span>
                        <span className="icon-bar"></span>
                    </button>
                    <Link to="status" className="navbar-brand">
                        <span className="navbar-logo">
                        </span>
                        Centrifugo
                    </Link>
                </div>
                <div className="collapse navbar-collapse navbar-ex8-collapse">
                    <ul className="nav navbar-nav">
                        <li>
                            <a href="http://fzambia.gitbooks.io/centrifugal/content/" target="_blank">
                                Documentation
                            </a>
                        </li>
                        <li>
                            <a href="https://github.com/centrifugal/centrifugo" target="_blank">
                                Source code
                            </a>
                        </li>
                        <li className={logoutClasses}>
                            <a href="#" onClick={this.handleLogout}>Logout</a>
                        </li>
                    </ul>
                </div>
            </nav>
        )
    }
});

var Sidebar = React.createClass({
    mixins: [Router.State],
    render: function () {
        var cx = Addons.addons.classSet;
        var isStatusActive = this.isActive('status', {}, {});
        var statusClasses = cx({'active': isStatusActive});
        var isOptionsActive = this.isActive('options', {}, {});
        var optionsClasses = cx({'active': isOptionsActive});
        var isMessagesActive = this.isActive('messages', {}, {});
        var messagesClasses = cx({'active': isMessagesActive});
        var isActionsActive = this.isActive('actions', {}, {});
        var actionsClasses = cx({'active': isActionsActive});
        return (
            <div className="col-lg-2 col-md-2 col-sm-12 col-xs-12 sidebar">
                <ul className="nav nav-pills nav-stacked">
                    <li className={statusClasses}>
                        <Link to="status">
                            <i className="glyphicon glyphicon-equalizer"></i>&nbsp;Status
                        </Link>
                    </li>
                    <li className={optionsClasses}>
                        <Link to="options">
                            <i className="glyphicon glyphicon-cog"></i>&nbsp;Options
                        </Link>
                    </li>
                    <li className={messagesClasses}>
                        <Link to="messages">
                            <i className="glyphicon glyphicon-envelope"></i>&nbsp;Messages
                            <span className="badge">{this.props.messageCounter > 0?this.props.messageCounter:""}</span>
                        </Link>
                    </li>
                    <li className={actionsClasses}>
                        <Link to="actions">
                            <i className="glyphicon glyphicon-fire"></i>&nbsp;Actions
                        </Link>
                    </li>
                </ul>
            </div>
        )
    }
});

var ConnectionStatus = React.createClass({
    getDefaultProps: function () {
        return {
            isConnected: false
        }
    },
    render: function () {
        if (this.props.isConnected) {
            return (
                <span className="pull-right connected label label-success" title='connected to Centrifuge'>
                    connected
                </span>
            )
        } else {
            return (
                <span className="pull-right not-connected label label-danger" title='disconnected from Centrifuge'>
                    disconnected
                </span>
            )
        }
    }
});

var StatusHandler = React.createClass({
    getInitialState: function () {
        return {}
    },
    componentDidMount: function () {
    },
    render: function () {
        var nodeRows;
        if (Object.keys(this.props.dashboard.nodes).length > 0) {
            nodeRows = [];
            for (var uid in this.props.dashboard.nodes) {
                if (this.props.dashboard.nodes.hasOwnProperty(uid)) {
                    var node = this.props.dashboard.nodes[uid];
                    nodeRows.push(<NodeRow node={node} key={uid} />);
                }
            }
        } else {
            nodeRows = <NodeRowLoader />;
        }
        return (
            <div className="content">
                <div className="stat-row">
                    <span className="text-muted stat-key">Version:</span>
                &nbsp;
                    <span className="stat-value">{this.props.dashboard.version}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">SockJS endpoint:</span>
                &nbsp;
                    <span className="stat-value">{this.props.dashboard.sockjsEndpoint}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">WebSocket endpoint:</span>
                &nbsp;
                    <span className="stat-value">{this.props.dashboard.wsEndpoint}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">HTTP API endpoint:</span>
                &nbsp;
                    <span className="stat-value">{this.props.dashboard.apiEndpoint}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">Engine:</span>
                &nbsp;
                    <span className="stat-value">{this.props.dashboard.engine}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">Connected to node:</span>
                &nbsp;
                    <span className="stat-value" id="current-node">{this.props.dashboard.nodeName}</span>
                </div>
                <div className="stat-row">
                    <span className="text-muted stat-key">Nodes running:</span>
                &nbsp;
                    <span className="stat-value" id="node-count">{this.props.dashboard.nodeCount}</span>
                </div>
                <div className="node_info">
                    <table className="table table-bordered">
                        <thead className="cf">
                            <tr>
                                <th title="node name">Node name</th>
                                <th title="total active channels">Channels</th>
                                <th title="total connected clients">Clients</th>
                                <th title="total unique clients">Unique Clients</th>
                            </tr>
                        </thead>
                        <tbody id="node-info">
                            {nodeRows}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
});

var NodeRowLoader = React.createClass({
    render: function () {
        return (
            <tr>
                <td colSpan="4">Waiting for information...</td>
            </tr>
        )
    }
});

var NodeRow = React.createClass({
    render: function () {
        return (
            <tr>
                <td>{this.props.node.name}</td>
                <td>{this.props.node.num_channels}</td>
                <td>{this.props.node.num_clients}</td>
                <td>{this.props.node.num_unique_clients}</td>
            </tr>
        )
    }
});

var NamespaceRow = React.createClass({
    render: function () {
        var options = $.extend({}, this.props.namespace);
        delete options["name"];
        var optionsJson = prettifyJson(options);
        return (
            <div>
                <h5>{this.props.namespace.name}:</h5>
                <pre dangerouslySetInnerHTML={{"__html": optionsJson}} />
            </div>
        )
    }
});

var NamespaceTable = React.createClass({
    render: function () {
        var namespaces = this.props.namespaces;
        return (
            <div>
                {namespaces.map(function (namespace, index) {
                    return (
                        <NamespaceRow key={index} namespace={namespace} />
                    )
                })}
            </div>
        )
    }
});

var NamespacesNotConfigured = React.createClass({
    render: function () {
        return (
            <pre>
                Namespaces not configured
            </pre>
        )
    }
});

var NotFoundHandler = React.createClass({
    render: function () {
        return (
            <div className="content">
                <h2>404 not found</h2>
            </div>
        )
    }
});

var OptionsHandler = React.createClass({
    mixins: [Router.State],
    getInitialState: function () {
        return {
            secretHidden: true
        }
    },
    toggleSecret: function() {
        var secretHidden = this.state.secretHidden;
        if (secretHidden) {
            this.setState({secretHidden: !secretHidden});
        }
    },
    render: function () {
        var options = this.props.dashboard.channelOptions || {};
        var optionsJson = prettifyJson(options);
        var namespaces = this.props.dashboard.namespaces || [];
        var cx = Addons.addons.classSet;
        var secretClasses = cx({
            "secret-hidden": this.state.secretHidden
        });
        var secretText;
        if (this.state.secretHidden) {
            secretText = "click to see secret";
        } else {
            secretText = this.props.dashboard.secret;
        }
        var connLifetimeText;
        if (this.props.dashboard.connectionLifetime == 0) {
            connLifetimeText = "Client connections do not expire (connection_lifetime=0)";
        } else {
            connLifetimeText = "Client must refresh its connection every " + this.props.dashboard.connectionLifetime + " seconds";
        }
        var ns;
        if (namespaces.length > 0) {
            ns = <NamespaceTable namespaces={namespaces} />
        } else {
            ns = <NamespacesNotConfigured />
        }
        return (
            <div className="content">
                <p className="content-help">Various important configuration options here</p>
                <h4>Secret</h4>
                <pre className={secretClasses} onClick={this.toggleSecret}>{secretText}</pre>
                <h4>Channel options</h4>
                <pre dangerouslySetInnerHTML={{"__html": optionsJson}} />
                <h4>Namespaces</h4>
                {ns}
                <h4>Connection Lifetime</h4>
                <pre>{connLifetimeText}</pre>
            </div>
        )
    }
});

var MessagesHandler = React.createClass({
    mixins: [Router.State],
    componentDidMount: function () {
        this.props.clearMessageCounter();
    },
    render: function () {
        var messages = this.props.dashboard.messages;
        if (!messages) {
            messages = [];
        }
        return (
            <div className="content">
                <p className="content-help">Waiting for messages from channels with "watch" option enabled...</p>
                {messages.map(function (message, index) {
                    return (
                        <Message key={index} message={message} />
                    )
                })}
            </div>
        )
    }
});

var ActionsHandler = React.createClass({
    mixins: [Router.State],
    editor: null,
    fields: ["channel", "channels", "data", "user"],
    methodFields: {
        "publish": ["channel", "data"],
        "broadcast": ["channels", "data"],
        "presence": ["channel"],
        "history": ["channel"],
        "unsubscribe": ["channel", "user"],
        "disconnect": ["user"],
        "channels": [],
        "stats": []
    },
    handleMethodChange: function () {
        var method = $(this.refs.method.getDOMNode()).val();
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
    },
    getInitialState: function() {
        return {
            loading: false,
            uid: ""
        }
    },
    componentDidMount: function () {
        this.editor = ace.edit('data-editor');
        this.editor.getSession().setMode('ace/mode/json');
        this.editor.setTheme('ace/theme/monokai');
        this.editor.setShowPrintMargin(false);
        this.editor.getSession().setUseSoftTabs(true);
        this.editor.getSession().setUseWrapMode(true);
        this.handleMethodChange();
    },
    componentWillReceiveProps: function(nextProps) {
        if (nextProps.dashboard.actionResponse && this.state.loading && this.state.uid === nextProps.dashboard.actionResponse.uid ) {
            this.setState({loading: false, uid: ""});
            if (nextProps.dashboard.actionResponse.error) {
                this.showError(nextProps.dashboard.actionResponse.error);
            } else {
                this.showSuccess();
            }
        }
    },
    hideError: function() {
        var error = $(this.refs.error.getDOMNode());
        error.addClass("hidden");
    },
    hideSuccess: function() {
        var success = $(this.refs.success.getDOMNode());
        success.addClass("hidden");
    },
    showError: function(text) {
        var error = $(this.refs.error.getDOMNode());
        error.text("Error: " + text);
        if (error.hasClass("hidden")) {
            this.hideSuccess();
            error.stop().hide().removeClass("hidden").fadeIn();
        }
    },
    showSuccess: function() {
        var success = $(this.refs.success.getDOMNode());
        if (success.hasClass("hidden")) {
            this.hideError();
            success.stop().hide().removeClass('hidden').fadeIn();
        }
    },
    handleSubmit: function (e) {
        e.preventDefault();
        if (!this.props.dashboard.isConnected) {
            this.showError("Can't send in disconnected state");
            return;
        }
        var methodElem = $(this.refs.method.getDOMNode());
        var method = methodElem.val();
        var publishData;
        if (methodElem.val() === "publish" || methodElem.val() === "broadcast") {
            publishData = this.editor.getSession().getValue();
            try {
                var json = JSON.stringify(JSON.parse(publishData));
            } catch (e) {
                this.showError("malformed JSON");
                return;
            }
        }
        $(this.refs.data.getDOMNode()).val(json);
        var submitButton = $(this.refs.submit.getDOMNode());
        submitButton.attr('disabled', true);
        var fieldsForParams = this.methodFields[method];
        var params = {};
        for (var i in fieldsForParams) {
            var field = $('#' + fieldsForParams[i]);
            params[fieldsForParams[i]] = field.val();
        }
        if (method === "publish" || method === "broadcast") {
            // publish and broadcast are somewhat special as they have raw JSON in data.
            params["data"] = JSON.parse(publishData);
        }
        if (method === "broadcast") {
            // convert space separated channels to array of channels.
            params["channels"] = $("#channels").val().split(" ");
        }
        this.hideError();
        this.hideSuccess();
        var uid = this.props.sendAction(method, params);
        this.setState({loading: true, uid: uid});
    },
    render: function () {
        var cx = Addons.addons.classSet;
        var loaderClasses = cx({'hidden': !this.state.loading});
        var requestData = this.props.dashboard.actionRequest;
        var responseData = this.props.dashboard.actionResponse;
        var request = requestData?prettifyJson(requestData):"";
        var response = responseData?prettifyJson(responseData):"";
        return (
            <div className="content">
                <p className="content-help">Execute command on server</p>
                <form ref="form" role="form" method="POST" action="" onSubmit={this.handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="method">Method</label>
                        <select className="form-control" ref="method" name="method" id="method" onChange={this.handleMethodChange}>
                            <option value="publish">publish</option>
                            <option value="broadcast">broadcast</option>
                            <option value="presence">presence</option>
                            <option value="history">history</option>
                            <option value="unsubscribe">unsubscribe</option>
                            <option value="disconnect">disconnect</option>
                            <option value="channels">channels</option>
                            <option value="stats">stats</option>
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
                        <textarea ref="data" className="hidden" id="data" name="data"></textarea>
                    </div>
                    <button type="submit" ref="submit" disabled={this.state.loading} className="btn btn-primary">Submit</button>
                    <span ref="error" className="box box-error hidden">Error</span>
                    <span ref="success" className="box box-success hidden">Success</span>
                </form>
                <div className="action-request">
                    <div className="action-label-container">
                        <span className="action-label">Last request:</span>
                    </div>
                    <pre ref="request" dangerouslySetInnerHTML={{"__html": request}} />
                </div>
                <div className="action-response">
                    <div className="action-label-container">
                        <span className="action-label">Last response:</span>
                        <span className={loaderClasses}>
                            <div className="loading">
                              <div className="loading-bar"></div>
                              <div className="loading-bar"></div>
                              <div className="loading-bar"></div>
                              <div className="loading-bar"></div>
                            </div>
                        </span>
                    </div>
                    <pre ref="response" dangerouslySetInnerHTML={{"__html": response}} />
                </div>
            </div>
        )
    }
});

var pad = function (n) {
    // http://stackoverflow.com/a/3313953/1288429
    return ("0" + n).slice(-2);
};

var Message = React.createClass({
    render: function () {
        return (
            <div className="message">
                <div className="message-header">
                    <span className="message-channel text-muted">
                        {this.props.message.channel}
                    </span>
                    <span className="message-time text-muted">{this.props.message.time}</span>
                </div>
                <div className="message-description">
                    <pre dangerouslySetInnerHTML={{"__html": prettifyJson(this.props.message.data)}} />
                </div>
            </div>
        )
    }
});

var routes = (
    <Route handler={App}>
        <DefaultRoute name="status" handler={StatusHandler} />
        <Route name="options" path="/options/" handler={OptionsHandler} />
        <Route name="messages" path="/messages/" handler={MessagesHandler} />
        <Route name="actions" path="/actions/" handler={ActionsHandler} />
        <NotFoundRoute name="404" handler={NotFoundHandler} />
    </Route>
);

module.exports = function () {
    Router.run(routes, function (Handler, state) {
        var app = document.getElementById("app");
        var prefix = app.dataset.prefix || "/";
        globalUrlPrefix = prefix;
        globalAuthUrl = prefix + "auth/";
        globalSocketUrl = prefix + "socket";
        React.render(<Handler query={state.query} />, app);
    });
};

