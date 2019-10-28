const webpackMerge = require('webpack-merge');
const commonConfig = require('./config/webpack.common.config');

module.exports = (env) => {
  const determineAddons = (addons) => [...[addons]]
    .filter((addon) => Boolean(addon))
    .map((addon) => require(`./config/addons/webpack.${addon}.js`)); // eslint-disable-line import/no-dynamic-require,global-require

  const envConfig = require(`./config/webpack.${env.env}.config`); // eslint-disable-line import/no-dynamic-require,global-require

  return webpackMerge(commonConfig, envConfig, ...determineAddons(env.addons));
};
