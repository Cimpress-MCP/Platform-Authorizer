/**
 * @copyright 2018–2020 Cimpress, Inc.
 * @license Apache-2.0
 */

'use strict'

const MinifyPlugin = require('babel-minify-webpack-plugin')
const { join } = require('path')

module.exports = {
  entry: { authorizer: './authorizer.js' },
  mode: 'development',
  module: {
    rules: [
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
