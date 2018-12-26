import React from 'react';
import { NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
var classNames = require('classnames');

export class Header extends React.Component {
    render() {
        let logoutClasses = classNames({'nav-link': true, 'd-none': this.props.insecure}); 
        return (
            <nav className="navbar navbar-expand-lg navbar-light">
                <a className="navbar-brand" href="/">
                    Centrifugo
                </a>
                <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#menu">
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="menu">
                    <ul className="navbar-nav mr-auto">
                        <li className="nav-item">
                            <div className="nav-link">
                                <NavLink to='/' activeClassName='menu selected' exact={true}><i className="fa fa-signal"></i> STATUS</NavLink>
                            </div>
                        </li>
                        <li className="nav-item">
                            <div className="nav-link">
                                <NavLink to='/actions' activeClassName='menu selected'><i className="fa fa-fire"></i> ACTIONS</NavLink>
                            </div>
                        </li>
                        <li className="nav-item">
                            <div className="nav-link">
                                <NavLink to='/links' activeClassName='menu selected'><i className="fa fa-link"></i> LINKS</NavLink>
                            </div>
                        </li>
                    </ul>
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item">
                            <a className={logoutClasses} href="#" onClick={this.props.handleLogout}>LOGOUT</a>
                        </li>
                    </ul>
                </div>
            </nav>
        );
    }
}

Header.propTypes = {
    handleLogout: PropTypes.func,
    insecure: PropTypes.bool
};
