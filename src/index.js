import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import './styles/app.scss';

const app = React.createElement(App);
ReactDOM.render(app, document.getElementById('app'));
