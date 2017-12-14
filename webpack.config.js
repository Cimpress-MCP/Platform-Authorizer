const { join } = require('path');
const MinifyPlugin = require('babel-minify-webpack-plugin');
// eslint-disable-next-line import/no-unresolved
const { lib: { entries: entry }} = require('serverless-webpack');

module.exports = {
  entry,
  target: 'node',
  stats: 'errors-only',
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
    path: join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  plugins: [
    new MinifyPlugin()
  ]
};
