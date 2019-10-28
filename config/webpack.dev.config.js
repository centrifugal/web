const webpack = require('webpack');
const commonPaths = require('./common-paths');

const config = {
  devtool: 'inline-source-map',
  devServer: {
    contentBase: commonPaths.outputPath,
    compress: true,
    historyApiFallback: true,
    hot: false,
    port: 10000,
    open: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
};

module.exports = config;
