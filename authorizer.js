/**
 * An authorization lambda function for the Cimpress Mass Customization Platform.
 *
 * @copyright 2018 Cimpress, Inc.
 * @license Apache-2.0
 */

'use strict'

import { decode, verify } from 'jsonwebtoken'
import JwksClient from 'jwks-rsa'
import { URL } from 'url'
import { promisify } from 'util'

const AUDIENCE = process.env['AUDIENCE']
const AUTHORITY = process.env['AUTHORITY']
const RESOURCE = process.env['RESOURCE']
const MISCONFIGURATION = "This authorizer is not configured as a 'TOKEN' authorizer."
const UNAUTHORIZED = 'Unauthorized'

const jwksUri = new URL('/.well-known/jwks.json', AUTHORITY)
const client = JwksClient({
  cache: true,
  rateLimit: true,
  jwksUri
})
const policyDocument = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'execute-api:Invoke',
      Effect: 'Allow',
      Resource: RESOURCE
    }
  ]
}
const getSigningKeyAsync = promisify(client.getSigningKey.bind(client))
const verifyAsync = promisify(verify)

/**
 * An event indicating a request coming into API Gateway that requires authorization.
 *
 * @typedef {Object} ApiGatewayAuthorizationEvent
 * @property {!String} type The type of authorization that has been requested.
 * @property {!String} authorizationToken The token to be checked for authentication.
 */

/**
 * Performs JWT Bearer authentication, and calls the provided callback.
 *
 * @param {!ApiGatewayAuthorizationEvent} event The event that caused this function to be invoked.
 * @param {!String} event.type The type of authorization that has been requested.
 * @param {!String} event.authorizationToken The token to be checked for authentication.
 * @returns {!Promise.<Object>} A promise which, when resolved, signals the result of authorization.
 */
export default async function ({ type: eventType, authorizationToken: token }) {
  if (eventType !== 'TOKEN') { // note(cosborn) Configuration check.
    throw MISCONFIGURATION
  }

  if (!token) { // note(cosborn) The configuration of the authorizer should handle this but sure why not
    throw UNAUTHORIZED
  }

  const [, tokenValue] = token.match(/^Bearer +(.*)$/) || [] // note(cosborn) Should also be handled by config.
  const decoded = decode(tokenValue, { complete: true })
  if (!decoded) {
    console.log('Authorization token could not be decoded.', { token })
    throw UNAUTHORIZED
  }

  const { header: { kid } = { } } = decoded
  if (!kid) {
    console.log("No 'kid' found in token header.", { header: decoded.header })
    throw UNAUTHORIZED
  }

  try {
    const key = await getSigningKeyAsync(kid)
      .then(({ publicKey, rsaPublicKey }) => publicKey || rsaPublicKey)
    const { sub: principalId, scope } = await verifyAsync(tokenValue, key, {
      audience: AUDIENCE,
      issuer: AUTHORITY
    })
    return { principalId, policyDocument, context: { scope } }
  } catch (err) {
    console.log('An error occurred validating the token.', { jwksUri, kid, err })
    throw UNAUTHORIZED
  }
}
