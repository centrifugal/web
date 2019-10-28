import React from 'react';
import {
  HashRouter, Route, Switch, Redirect,
} from 'react-router-dom';
import PropTypes from 'prop-types';

import Header from '../header/Header';
import StatusPage from '../pages/StatusPage';
import ActionsPage from '../pages/ActionsPage';
import LinksPage from '../pages/LinksPage';

const $ = require('jquery');

const globalUrlPrefix = window.location.pathname;

let infoLoadTimeout;

export default class AppRouter extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      nodeCount: 0,
      nodes: [],
      actionRequest: null,
      actionResponse: null,
    };
    this.sendAction = this.sendAction.bind(this);
  }

  componentDidMount() {
    this.askInfo();
  }

  componentWillUnmount() {
    if (infoLoadTimeout) {
      clearTimeout(infoLoadTimeout);
    }
  }

  handleInfo(info) {
    this.setState({
      nodes: info.nodes,
      nodeCount: Object.keys(info.nodes).length,
    });
  }

  sendAction(method, params) {
    const cmd = {
      method,
      params,
    };

    this.setState({ actionRequest: cmd });

    const self = this;

    const headers = {};
    const { insecure } = this.props;
    if (!insecure) {
      headers.Authorization = `token ${localStorage.getItem('token')}`;
    }

    $.ajax({
      url: `${globalUrlPrefix}admin/api`,
      type: 'post',
      data: JSON.stringify(cmd),
      headers,
      dataType: 'json',
      success(data) {
        self.setState({ actionResponse: data, loading: false });
      },
      error(jqXHR) {
        if (jqXHR.status === 401) {
          self.props.handleLogout();
        }
      },
    });
  }

  askInfo() {
    const self = this;
    const headers = {};
    const { insecure } = this.props;
    if (!insecure) {
      headers.Authorization = `token ${localStorage.getItem('token')}`;
    }
    $.ajax({
      url: `${globalUrlPrefix}admin/api`,
      type: 'post',
      data: JSON.stringify({
        method: 'info',
        params: {},
      }),
      headers,
      dataType: 'json',
      success(data) {
        self.handleInfo(data.result);
        infoLoadTimeout = setTimeout(() => {
          self.askInfo();
        }, 5000);
      },
      error(jqXHR) {
        if (jqXHR.status === 401) {
          self.props.handleLogout();
          return;
        }
        infoLoadTimeout = setTimeout(() => {
          self.askInfo();
        }, 5000);
      },
    });
  }

  render() {
    const { insecure, handleLogout } = this.props;
    const
      {
        nodes, nodeCount, loading, actionRequest, actionResponse,
      } = this.state;
    return (
      <HashRouter>
        <div>
          <Header insecure={insecure} handleLogout={handleLogout} />
          <Switch>
            <Route path="/" render={() => <StatusPage nodes={nodes} nodeCount={nodeCount} />} exact />
            <Route path="/actions" render={() => <ActionsPage loading={loading} actionRequest={actionRequest} actionResponse={actionResponse} sendAction={this.sendAction} />} />
            <Route path="/links" component={LinksPage} />
            <Redirect to="/" />
          </Switch>
        </div>
      </HashRouter>
    );
  }
}

AppRouter.propTypes = {
  insecure: PropTypes.bool.isRequired,
  handleLogout: PropTypes.func.isRequired,
};
