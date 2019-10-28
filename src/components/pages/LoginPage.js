
import React from 'react';
import PropTypes from 'prop-types';

const classNames = require('classnames');

export default class LoginPage extends React.Component {
  constructor() {
    super();

    this.state = {
      focus: false,
      password: '',
    };
  }

  componentDidMount() {
    // try to login with empty password – maybe admin_insecure option enabled in Centrifugo.
    const { handleLogin } = this.props;
    handleLogin('');
  }

  handleSubmit(e) {
    e.preventDefault();
    const { password } = this.state;
    const { handleLogin } = this.props;
    handleLogin(password);
  }

  updatePasswordValue(evt) {
    this.setState({ password: evt.target.value });
  }

  inputFocus() {
    this.setState({ focus: true });
  }

  inputBlur() {
    this.setState({ focus: false });
  }

  render() {
    const { focus } = this.state;
    const loginClasses = classNames({ login: true, 'login-focus': focus });
    return (
      <div className={loginClasses}>
        <a href="https://github.com/centrifugal/centrifugo" rel="noopener noreferrer" target="_blank">
          <img className="login-forkme" src="https://camo.githubusercontent.com/38ef81f8aca64bb9a64448d0d70f1308ef5341ab/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f72696768745f6461726b626c75655f3132313632312e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png" />
        </a>
        <div className="login-body">
          <div className="container">
            <div className="row">
              <div className="col text-center">
                <div className="login-logo">
                  <div className="spin">
                    <div className="login-logo-outer" />
                    <div className="login-logo-inner" />
                  </div>
                </div>
                <h1 className="login-heading">CENTRIFUGO</h1>
                <form action="" method="post" className="login-form" onSubmit={this.handleSubmit.bind(this)}>
                  <div className="form-group">
                    <input onChange={this.updatePasswordValue.bind(this)} onFocus={this.inputFocus.bind(this)} onBlur={this.inputBlur.bind(this)} autoComplete="off" className="form-control" type="password" name="password" placeholder="Type password to log in..." />
                  </div>
                  <button type="submit" onFocus={this.inputFocus.bind(this)} onBlur={this.inputBlur.bind(this)} className="btn btn-success login-submit">
                    <i className="fa fa-sign-in-alt" />
                    {' '}
Log In
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

LoginPage.propTypes = {
  handleLogin: PropTypes.func.isRequired,
};
