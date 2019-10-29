const webpackMerge = require('webpack-merge');
const commonConfig = require('./config/webpack.common.config');

module.exports = (env) => {
  const envConfig = require(`./config/webpack.${env.env}.config`); // eslint-disable-line import/no-dynamic-require,global-require
  return webpackMerge(commonConfig, envConfig);
};
