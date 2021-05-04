/**
 * @copyright 2018–2021 Cimpress plc
 * @license Apache-2.0
 */

'use strict'

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
    library: {
      type: 'commonjs2'
    }
  },
  stats: 'errors-only',
  target: 'node'
}
