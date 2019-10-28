import React from 'react';
import AppRouter from './routers/AppRouter';
import LoginPage from './pages/LoginPage';

const $ = require('jquery');

const globalUrlPrefix = window.location.pathname;

export default class App extends React.Component {
  constructor() {
    super();
    const state = {};
    if (localStorage.getItem('token')) {
      state.isAuthenticated = true;
    }
    if (localStorage.getItem('insecure')) {
      state.insecure = true;
    } else {
      state.insecure = false;
    }
    this.state = state;
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  handleLogin(password) {
    $.post(`${globalUrlPrefix}admin/auth`, { password }, 'json').done((data) => {
      localStorage.setItem('token', data.token);
      const insecure = data.token === 'insecure';
      if (insecure) {
        localStorage.setItem('insecure', true);
      }
      this.setState({ isAuthenticated: true, insecure });
    }).fail(() => {
      $.noop();
    });
  }

  handleLogout(e) {
    if (e) {
      e.preventDefault();
    }
    delete localStorage.token;
    delete localStorage.insecure;
    this.setState({ isAuthenticated: false, insecure: false });
  }

  render() {
    const { isAuthenticated } = this.state;
    const { insecure } = this.state;
    if (isAuthenticated) {
      return (
        <AppRouter handleLogout={this.handleLogout} insecure={insecure} />
      );
    }
    return (
      <LoginPage handleLogin={this.handleLogin} />
    );
  }
}
