import React, { Fragment } from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';

import { Header } from '../header/Header';
import { StatusPage } from '../pages/StatusPage';
import { ActionsPage } from '../pages/ActionsPage';
import { LinksPage } from '../pages/LinksPage';

var $ = require('jquery');

var globalUrlPrefix = window.location.pathname;

var infoLoadTimeout;

export class AppRouter extends React.Component{

    constructor() {
        super();
        this.state = {
            engine: '',
            nodeCount: '',
            nodes: [],
            actionRequest: null,
            actionResponse: null
        };
    }

    handleInfo(info) {
        this.setState({
            engine: info.engine,
            nodes: info.nodes,
            nodeCount: Object.keys(info.nodes).length
        });
    }

    sendAction(method, params) {
        let cmd = {
            method: method,
            params: params
        };

        this.setState({actionRequest: cmd});

        var self = this;

        var headers = {};
        if (!this.props.insecure) {
            headers['Authorization'] = 'token ' +  localStorage.getItem('token');
        }

        $.ajax({
            url: globalUrlPrefix + 'admin/api',
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
    }

    askInfo() {
        var self = this;
        var headers = {};
        if (!this.props.insecure) {
            headers['Authorization'] = 'token ' +  localStorage.getItem('token');
        }
        $.ajax({
            url: globalUrlPrefix + 'admin/api',
            type: 'post',
            data: JSON.stringify({
                'method': 'info',
                'params': {}
            }),
            headers: headers,
            dataType: 'json',
            success: function (data) {
                self.handleInfo(data.result);
                infoLoadTimeout = setTimeout(function(){
                    self.askInfo();
                }, 5000);
            },
            error: function(jqXHR) {
                if (jqXHR.status === 401) {
                    self.props.handleLogout();
                    return;
                }
                infoLoadTimeout = setTimeout(function(){
                    self.askInfo();
                }, 5000);
            }
        });
    }

    componentDidMount() {
        this.askInfo();
    }

    componentWillUnmount() {
        if (infoLoadTimeout) {
            clearTimeout(infoLoadTimeout);
        }
    }

    render() {
        return (
            <HashRouter>
                <Fragment>
                    <Header {...this.props} />            
                    <Switch>
                        <Route path='/' render={()=><StatusPage dashboard={this.state}/>} exact={true} />
                        <Route path='/actions' render={()=><ActionsPage dashboard={this.state} sendAction={this.sendAction.bind(this)} />} />
                        <Route path='/links' component={LinksPage} />
                        <Redirect to="/" />
                    </Switch>
                </Fragment>
            </HashRouter>
        );
    }
}
