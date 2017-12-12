'use strict';

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
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

  const authority = event.stageVariables['AUTHORITY'];
  if (!authority) {
    return callback("No stage variable 'AUTHORITY' is provided.");
  }

  const client = jwksClient({
    cache: true,
    rateLimit: true,
    jwksUri: new URL('/.well-known/jwks.json', authority)
  });

  client.getSigningKey(decodedToken.header.kid, (err, key) => {
    if (err) {
      console.log('Error getting signing key.', { kid, err });
      return callback("Unauthorized");
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    jwt.verify(encodedToken, signingKey, {
      audience: [ event.stageVariables['PLATFORM_ID'], event.stageVariables['CLIENT_ID'] ],
      issuer: authority
    }, (err, verified) => {
      if (err) {
        console.log("Error verifying token.", { err })
        return callback("Unauthorized");
      }

      return callback(null, {
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
      })
    });
  });
};
