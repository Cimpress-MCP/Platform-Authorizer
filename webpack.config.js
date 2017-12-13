const path = require('path');
// eslint-disable-next-line import/no-unresolved
const slsw = require('serverless-webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  stats: 'errors-only',
  module: {
    loaders: [{
      test: /\.js$/,
      include: __dirname,
      exclude: /node_modules/,
    }],
  },
  plugins: [
    new UglifyJsPlugin()
  ]
};
