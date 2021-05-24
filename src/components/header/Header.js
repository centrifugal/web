import React from 'react';
import { NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';

const classNames = require('classnames');

// eslint-disable-next-line react/prefer-stateless-function
export default class Header extends React.Component {
  render() {
    const { insecure } = this.props;
    const { handleLogout } = this.props;
    const logoutClasses = classNames({ 'nav-link': true, 'd-none': insecure });
    return (
      <nav className="navbar navbar-expand-lg navbar-light">
        <a className="navbar-brand" href="/">
                    Centrifugo
        </a>
        <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#menu">
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="menu">
          <ul className="navbar-nav mr-auto">
            <li className="nav-item">
              <div className="nav-link">
                <NavLink to="/" activeClassName="menu selected" exact>
                  <i className="fa fa-signal" />
                  {' '}
STATUS
                </NavLink>
              </div>
            </li>
            <li className="nav-item">
              <div className="nav-link">
                <NavLink to="/actions" activeClassName="menu selected">
                  <i className="fa fa-fire" />
                  {' '}
ACTIONS
                </NavLink>
              </div>
            </li>
            <li className="nav-item">
              <div className="nav-link">
                <NavLink to="/tracing" activeClassName="menu selected">
                  <i className="fa fa-play" />
                  {' '}
TRACING
                </NavLink>
              </div>
            </li>
          </ul>
          <ul className="navbar-nav ml-auto">
            <li className="nav-item">
              <a className={logoutClasses} href="#" onClick={handleLogout}>LOGOUT</a>
            </li>
          </ul>
        </div>
      </nav>
    );
  }
}

Header.propTypes = {
  handleLogout: PropTypes.func.isRequired,
  insecure: PropTypes.bool.isRequired,
};
