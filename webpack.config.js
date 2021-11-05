/**
 * @copyright 2018–2021 Cimpress plc
 * @license Apache-2.0
 */

module.exports = {
    "entry": {"authorizer": "./authorizer.js"},
    "mode": "development",
    "module": {
        "rules": [
            {
                "exclude": /node_modules/u,
                "loader": "babel-loader",
                "test": /\.js$/u
            }
        ]
    },
    "output": {
        "library": {
            "type": "commonjs2"
        }
    },
    "target": "node"
};
