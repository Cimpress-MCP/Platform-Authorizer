'use strict';

const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const jwks = require('jwks-rsa');
const { URL } = require('url');
const AUTHORITY = 'https://cimpress.auth0.com/';

module.exports.handler = (event, context, callback) => {
  if (event.type !== 'TOKEN') { // note(cosborn) Configuration check.
    return callback("This authorizer is not configured as a 'TOKEN' authorizer.");
  }

  var { authorizationToken } = event;
  if (!authorizationToken) { // note(cosborn) The configuration of the authorizer should handle this but sure why not
    return callback("No header 'Authorization' is provided.")
  }

  const [, encodedToken] = authorizationToken.match(/^Bearer (.*)$/); // note(cosborn) Should also be handled by config.
  const decodedToken = jwt.decode(encodedToken, { complete: true });
  if (!decodedToken) {
    console.log('Authorization token could not be decoded.', { authorizationToken });
    return callback('Unauthorized');
  }

  const { header: { kid } = { } } = decodedToken;
  if (!kid) {
    console.log("No 'kid' found in token header.", { header: decodedToken.header });
    callback('Unauthorized');
  }

  const jwksUri = new URL('/.well-known/jwks.json', AUTHORITY);
  const client = Promise.promisifyAll(jwks({
    cache: true,
    rateLimit: true,
    jwksUri
  }));

  return client.getSigningKeyAsync(kid)
    .then(key => key.publicKey || key.rsaPublicKey)
    .then(key => jwt.verifyAsync(encodedToken, key, {
      audience: 'https://api.cimpress.io/',
      issuer: AUTHORITY
    }))
    .then(({ sub, scope }) => ({
      principalId: sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      },
      context: { scope }
    }))
    .then(resp => callback(null, resp))
    .tapCatch(jwks.SigningKeyNotFoundError, err => console.log("Could not retrieve signing key from 'kid'.", { kid, err }))
    .tapCatch(jwks.JwksError, err => console.log('An error occurred in retrieving a JWKS.', { jwksUri, err }))
    .tapCatch(jwks.JwksRateLimitError, err => console.log('The JWKS endpoint is rate-limited.', { err }))
    .tapCatch(jwt.TokenExpiredError, err => console.log('The provided token has expired.', { err }))
    .tapCatch(jwt.JsonWebTokenError, err => console.log('The provided token was not valid.', { err }))
    .catch(_ => callback('Unauthorized'));
};
