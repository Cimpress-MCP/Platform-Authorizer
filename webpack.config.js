/**
 * @license Apache-2.0
 */

'use strict'

const { join } = require('path')
const MinifyPlugin = require('babel-minify-webpack-plugin')

module.exports = {
  entry: { authorizer: './authorizer.js' },
  target: 'node',
  stats: 'errors-only',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'eslint-loader',
        options: {
          baseConfig: {
            extends: [
              'eslint:recommended',
              'standard',
              'plugin:import/errors',
              'plugin:import/warnings',
              'plugin:promise/recommended'
            ]
          },
          parserOptions: {
            ecmaVersion: 2017,
            ecmaFeatures: {
              impliedStrict: true
            },
            sourceType: 'module'
          },
          envs: [ 'node', 'es6' ],
          rules: {
            'no-console': 'off'
          },
        },
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: [
            [ 'env', { targets: { node: '8.10' } } ]
          ]
        },
        exclude: /node_modules/
      }
    ]
  },
  output: {
    libraryTarget: 'commonjs2',
    path: join(__dirname, 'dist'),
    filename: '[name].js'
  },
  plugins: [ new MinifyPlugin() ]
}
