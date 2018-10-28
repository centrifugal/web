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

var pad = function (n) {
    // http://stackoverflow.com/a/3313953/1288429
    return ("0" + n).slice(-2);
};

function humanSeconds(seconds) {
    var numyears = Math.floor(seconds / 31536000);
    var numdays = Math.floor((seconds % 31536000) / 86400); 
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    res = "";
    if (numyears > 0) {
        res += numyears + "y ";
    }
    if (numdays > 0) {
        res += numdays + "d ";
    }
    if (numhours > 0) {
        res += pad(numhours) + "h ";
    }
    if (numminutes > 0) {
        res += pad(numminutes) + "m ";
    }
    if (numseconds > 0) {
        res += pad(numseconds) + "s";
    }
    return res;
}

function humanBytes(bytes) {
    var thresh = 1024;
    if(Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = ['kB','MB','GB','TB','PB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
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
        $.post(globalUrlPrefix + "admin/auth", {password: password}, "json").done(function (data) {
            localStorage.setItem("token", data.token);
            var insecure = data.token === "insecure";
            if (insecure) {
                localStorage.setItem("insecure", true);
            }
            this.setState({isAuthenticated: true, insecure: insecure});
        }.bind(this)).fail(function () {
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
                <Dashboard handleLogout={this.handleLogout} insecure={this.state.insecure} {...this.props} />
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

var Dashboard = React.createClass({
    mixins: [Router.State],
    getInitialState: function () {
        return {
            engine: "",
            nodeCount: "",
            nodes: [],
            actionRequest: null,
            actionResponse: null
        }
    },
    handleInfo: function(info) {
        this.setState({
            engine: info.engine,
            nodes: info.nodes,
            nodeCount: Object.keys(info.nodes).length
        });
    },
    sendAction: function(method, params) {
        cmd = {
            method: method,
            params: params
        };

        this.setState({actionRequest: cmd});

        var self = this;

        var headers = {};
        if (!this.props.insecure) {
            headers["Authorization"] = "token " +  localStorage.getItem("token");
        }

        $.ajax({
            url: globalUrlPrefix + "admin/api",
            type: 'post',
            data: JSON.stringify(cmd),
            headers: headers,
            dataType: 'json',
            success: function (data) {
                self.setState({actionResponse: data, loading: false});
            },
            error: function(jqXHR) {
                if (jqXHR.status === 401) {
                    self.props.handleLogout();
                }
            }
        });
    },
    askInfo: function() {
        var self = this;
        var headers = {};
        if (!this.props.insecure) {
            headers["Authorization"] = "token " +  localStorage.getItem("token");
        }
        $.ajax({
            url: globalUrlPrefix + "admin/api",
            type: 'post',
            data: JSON.stringify({
                "method": "info",
                "params": {}
            }),
            headers: headers,
            dataType: 'json',
            success: function (data) {
                self.handleInfo(data.result);
                setTimeout(function(){
                    self.askInfo();
                }, 10000);
            },
            error: function(jqXHR) {
                if (jqXHR.status === 401) {
                    self.props.handleLogout();
                }
            }
        });
    },
    componentDidMount: function () {
        this.askInfo();
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
                        <RouteHandler
                            dashboard={this.state}
                            handleLogout={this.props.handleLogout}
                            sendAction={this.sendAction}
                            clearMessageCounter={this.clearMessageCounter}
                            toggleMessagesRender={this.toggleMessagesRender}
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
                <a href="https://github.com/centrifugal/centrifugo" target="_blank">
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
                                <form action="" method="post" className="login-form" onSubmit={this.handleSubmit}>
                                    <div className="form-group">
                                        <input ref="password" onFocus={this.inputFocus} onBlur={this.inputBlur} autoComplete="off" className="form-control" type="password" name="password" placeholder="Type password to log in..."/>
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
                            <a href="https://centrifugal.github.io/centrifugo/" target="_blank">
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

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

var StatusHandler = React.createClass({
    getInitialState: function () {
        return {}
    },
    componentDidMount: function () {
    },
    render: function () {
        var nodeRows;
        if (this.props.dashboard.nodes.length > 0) {
            nodeRows = [];
            for (var i in sortByKey(this.props.dashboard.nodes, "name")) {
                var node = this.props.dashboard.nodes[i];
                nodeRows.push(<NodeRow node={node} key={node.uid} />);
            }
        } else {
            nodeRows = <NodeRowLoader />;
        }
        return (
            <div className="content">
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
                                <th title="node name">Version</th>
                                <th title="node name">Uptime</th>
                                <th title="total active channels">Channels</th>
                                <th title="total connected clients">Clients</th>
                                <th title="total unique clients">Users</th>
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
                <td colSpan="9">Waiting for information...</td>
            </tr>
        )
    }
});

var NodeRow = React.createClass({
    render: function () {
        return (
            <tr>
                <td>{this.props.node.name}</td>
                <td>{this.props.node.version}</td>
                <td>{humanSeconds(this.props.node.uptime)}</td>
                <td>{this.props.node.num_channels}</td>
                <td>{this.props.node.num_clients}</td>
                <td>{this.props.node.num_users}</td>
            </tr>
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

var ActionsHandler = React.createClass({
    mixins: [Router.State],
    editor: null,
    fields: ["channel", "channels", "data", "user"],
    methodFields: {
        "publish": ["channel", "data"],
        "broadcast": ["channels", "data"],
        "presence": ["channel"],
        "presence_stats": ["channel"],
        "history": ["channel"],
        "history_remove": ["channel"],
        "unsubscribe": ["channel", "user"],
        "disconnect": ["user"],
        "channels": [],
        "info": []
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
                this.showError(nextProps.dashboard.actionResponse.error.message);
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
        var fieldsForParams = this.methodFields[method];
        var params = {};
        for (var i in fieldsForParams) {
            var field = $('#' + fieldsForParams[i]);
            params[fieldsForParams[i]] = field.val();
        }
        if (method === "publish" && params["channel"] === "") {
            this.showError("channel required");
            return;
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
        this.setState({loading: true, uid: uid});
        var uid = this.props.sendAction(method, params);
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
                        <textarea ref="data" className="hidden" id="data" name="data"></textarea>
                    </div>
                    <button type="submit" ref="submit" disabled={this.state.loading} className="btn btn-primary">Submit</button>
                    <span ref="error" className="box box-error hidden">Error</span>
                    <span ref="success" className="box box-success hidden">Success</span>
                </form>
                <div className="action-request">
                    <div className="action-label-container">
                        <span className="action-label">Request:</span>
                    </div>
                    <pre ref="request" dangerouslySetInnerHTML={{"__html": request}} />
                </div>
                <div className="action-response">
                    <div className="action-label-container">
                        <span className="action-label">Response:</span>
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

var routes = (
    <Route handler={App}>
        <DefaultRoute name="status" handler={StatusHandler} />
        <Route name="actions" path="/actions/" handler={ActionsHandler} />
        <NotFoundRoute name="404" handler={NotFoundHandler} />
    </Route>
);

module.exports = function () {
    Router.run(routes, function (Handler, state) {
        var app = document.getElementById("app");
        globalUrlPrefix = window.location.pathname;
        React.render(<Handler query={state.query} />, app);
    });
};

