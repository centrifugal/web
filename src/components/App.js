import React from 'react';
import { AppRouter } from './routers/AppRouter';
import { LoginPage } from './pages/LoginPage';
var $ = require('jquery');

var globalUrlPrefix = window.location.pathname;

export class App extends React.Component {

    constructor() {
        super();
        this.props;
        var state = {};
        if (localStorage.getItem('token')) {
            state['isAuthenticated'] = true;
        }
        if (localStorage.getItem('insecure')) {
            state['insecure'] = true;
        }
        this.state = state;
    }

    handleLogin(password) {
        $.post(globalUrlPrefix + 'admin/auth', {password: password}, 'json').done(function (data) {
            localStorage.setItem('token', data.token);
            var insecure = data.token === 'insecure';
            if (insecure) {
                localStorage.setItem('insecure', true);
            }
            this.setState({isAuthenticated: true, insecure: insecure});
        }.bind(this)).fail(function () {
            $.noop();
        });
    }

    handleLogout(e) {
        if (e) {
            e.preventDefault();
        }
        delete localStorage.token;
        delete localStorage.insecure;
        this.setState({isAuthenticated: false, insecure: false});
    }

    render() {
        if (this.state.isAuthenticated) {
            return (
                <AppRouter handleLogout={this.handleLogout.bind(this)} insecure={this.state.insecure} />
            );
        } else {
            return (
                <LoginPage handleLogin={this.handleLogin.bind(this)} {...this.props} />
            );
        }
    }
}
