'use strict';

const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const JwksClient = require('jwks-rsa');
const { URL } = require('url');

module.exports.handler = (event, context, callback) => {
  if (!event.type || event.type !== 'REQUEST') { // note(cosborn) Configuration check.
    return callback("This authorizer is not configured as a 'REQUEST' authorizer.");
  }

  const authToken = event.headers['authorization'] || event.headers['Authorization'];
  if (!authToken) { // note(cosborn) The configuration of the authorizer should handle this but why not
    return callback("No header 'Authorization' is provided.")
  }

  const match = authToken.match(/^Bearer (.*)$/);
  if (!match || match.length < 2) {
    console.log("Value for header 'Authorization' is malformed.", { authToken });
    return callback("Unauthorized");
  }

  const [, encodedToken] = match;
  const decodedToken = jwt.decode(encodedToken, { complete: true });
  if (!decodedToken) {
    console.log("Authorization token could not be decoded.", { encodedToken });
    return callback("Unauthorized");
  }

  const {
    stageVariables: {
      AUTHORITY: authority,
      PLATFORM_ID: platformId,
      CLIENT_ID: clientId,
    }
  } = event;
  if (!authority) {
    return callback("No stage variable 'AUTHORITY' is provided.");
  }

  const client = new JwksClient({
    cache: true,
    rateLimit: true,
    jwksUri: new URL('/.well-known/jwks.json', authority)
  });

  Promise.promisify(client.getSigningKey, { context: client })(decodedToken.header.kid)
    .catch(err => {
      console.log('Error getting signing key.', { kid, err });
      return callback("Unauthorized");
    })
    .then(key => key.publicKey || key.rsaPublicKey)
    .then(signingKey => jwt.verify(encodedToken, signingKey, {
      audience: [ platformId, clientId ],
      issuer: authority
    }))
    .catch(err => {
      console.log('Error verifying token.', { err });
      return callback("Unauthorized");
    })
    .then(verified => callback(null, {
      principalId: verified.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      }
    }));
};
