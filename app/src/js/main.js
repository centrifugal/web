var $ = require('jquery'),
    React = require('react'),
    App = require('./app.jsx');


// React Dev Tools
if (typeof window !== 'undefined') window.React = React;


$(function(){
    App();
});
