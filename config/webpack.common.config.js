const webpack = require('webpack');
const CleanWebPackPlugin = require('clean-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const ExtractTextWebpackPlugin = require('extract-text-webpack-plugin');
const commonPaths = require('./common-paths');

const config = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: commonPaths.outputPath
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                test: /\.js$/,
                loader: 'eslint-loader',
                options: {
                    failOnWarning: true,
                    failOnerror: true
                },
                exclude: /node_modules/
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                options: {
                    presets: ['env', 'react']
                }
            },
            {
                test: /\.s?css$/,
                use: ExtractTextWebpackPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        {
                            loader: 'css-loader'
                        },
                        {
                            loader: 'sass-loader'
                        }
                    ]
                })                
            },
            {
                test: /\.svg|.png|.jpg$/,
                loader: 'url-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new ExtractTextWebpackPlugin('styles.css'),
        new CleanWebPackPlugin(['dist'], { root: commonPaths.root }),
        new HtmlWebPackPlugin({
            template: commonPaths.template,
            favicon: commonPaths.favicon,
            inject: true,
            hash: true
        })
    ]
};

module.exports = config;