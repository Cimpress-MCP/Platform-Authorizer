/**
 * @copyright 2018 Cimpress, Inc.
 * @license Apache-2.0
 */

'use strict'

const MinifyPlugin = require('babel-minify-webpack-plugin')
const { join } = require('path')

module.exports = {
  entry: { authorizer: './authorizer.js' },
  externals: [ 'aws-sdk' ],
  mode: 'development',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  output: {
    libraryTarget: 'commonjs2',
    path: join(__dirname, 'dist'),
    filename: '[name].js'
  },
  plugins: [ new MinifyPlugin() ],
  stats: 'errors-only',
  target: 'node'
}
