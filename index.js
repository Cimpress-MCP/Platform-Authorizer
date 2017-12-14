'use strict';

import { promisifyAll } from 'bluebird';
const { decode, verifyAsync } = promisifyAll(require('jsonwebtoken'));
import JwksClient from 'jwks-rsa';
import { resolve } from 'url';

const AUTHORITY = 'https://cimpress.auth0.com/';

export async function handler({ type: eventType, authorizationToken: token, methodArn }, context, callback) {
  if (eventType !== 'TOKEN') { // note(cosborn) Configuration check.
    return callback("This authorizer is not configured as a 'TOKEN' authorizer.");
  }

  if (!token) { // note(cosborn) The configuration of the authorizer should handle this but sure why not
    return callback("No header 'Authorization' is provided.")
  }

  const [, tokenValue] = token.match(/^Bearer (.*)$/) || []; // note(cosborn) Should also be handled by config.
  const decoded = decode(tokenValue, { complete: true });
  if (!decoded) {
    console.log('Authorization token could not be decoded.', { token });
    return callback('Unauthorized');
  }

  const { header: { kid } = { } } = decoded;
  if (!kid) {
    console.log("No 'kid' found in token header.", { header: decoded.header });
    callback('Unauthorized');
  }

  const jwksUri = resolve(AUTHORITY, '/.well-known/jwks.json');
  const client = promisifyAll(new JwksClient({
    cache: true,
    rateLimit: true,
    jwksUri
  }));

  try {
    const key = await client.getSigningKeyAsync(kid)
      .then(({ publicKey, rsaPublicKey }) => publicKey || rsaPublicKey);
    const { sub, scope } = await verifyAsync(tokenValue, key, {
      audience: 'https://api.cimpress.io/',
      issuer: AUTHORITY
    });
    const resp = {
      principalId: sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: methodArn
          }
        ]
      },
      context: { scope }
    };
    return callback(null, resp);
  } catch (err) {
    console.log('An error occurred validating the token.', { jwksUri, kid, err });
    return callback('Unauthorized');
  }
};
