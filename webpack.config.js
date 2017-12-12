const slsw = require('serverless-webpack');
module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  stats: 'errors-only',
  module: {
    rules: [{
      test: /\.js$/,
      include: __dirname,
      exclude: /node_modules/,
    }]
  }
};
