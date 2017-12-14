/**
 * An authorization lambda function for the Cimpress Mass Customization Platform.
 * @copyright 2017 Cimpress, Inc.
 */

 'use strict';

import { promisifyAll } from 'bluebird';
const { decode, verifyAsync } = promisifyAll(require('jsonwebtoken'));
import JwksClient from 'jwks-rsa';
import { resolve } from 'url';

const AUTHORITY = 'https://cimpress.auth0.com/';
const jwksUri = resolve(AUTHORITY, '/.well-known/jwks.json');
const client = promisifyAll(new JwksClient({
  cache: true,
  rateLimit: true,
  jwksUri
}));

/**
 * A callback indicating success or failure to the calling entity.
 * 
 * @callback eventCallback
 * @param {string} failure - A description of the failure.
 * @param {Object} success - An API Gateway authorizer response document.
 */

 /**
 * An event indicating a request coming into API Gateway that requires authorization.
 * 
 * @typedef {Object} ApiGatewayAuthorizationEvent
 * @property {!string} type - The type of authorization that has been requested.
 * @property {!string} authorizationToken - The token to be checked for authentication.
 * @property {!string} methodArn - The ARN of the method which requires authorization.
 */

/**
 * Performs JWT Bearer authentication, and calls the provided callback.
 * 
 * @function handler
 * @param {!ApiGatewayAuthorizationEvent} event - The event that caused this function to be invoked.
 * @param {!Object} context - The context associated with the event.
 * @param {!eventCallback} callback - A function that will be called when authentication succeeds or fails.
 * @returns {!Promise} - A promise which, when resolved, signals the result of authorization.
 */
export async function handler({ type: eventType, authorizationToken: token, methodArn }, context, callback) {
  if (eventType !== 'TOKEN') { // note(cosborn) Configuration check.
    return callback("This authorizer is not configured as a 'TOKEN' authorizer.");
  }

  if (!token) { // note(cosborn) The configuration of the authorizer should handle this but sure why not
    return callback("No header 'Authorization' is provided.");
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
    return callback('Unauthorized');
  }

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
}
