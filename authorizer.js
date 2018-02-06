/**
 * An authorization lambda function for the Cimpress Mass Customization Platform.
 * @copyright 2018 Cimpress, Inc.
 */

import { promisify, promisifyAll } from 'bluebird'
import { decode, verify } from 'jsonwebtoken'
import JwksClient from 'jwks-rsa'
import { resolve } from 'url'

const AUDIENCE = 'https://api.cimpress.io/'
const AUTHORITY = 'https://cimpress.auth0.com/'
const MISCONFIGURATION = new Error("This authorizer is not configured as a 'TOKEN' authorizer.")
const UNAUTHORIZED = new Error('Unauthorized')

const jwksUri = resolve(AUTHORITY, '/.well-known/jwks.json')
const client = promisifyAll(new JwksClient({
  cache: true,
  rateLimit: true,
  jwksUri
}))
const verifyAsync = promisify(verify)

/**
 * A callback indicating success or failure to the calling entity.
 *
 * @callback eventCallback
 * @param {String|Error} failure - A description of the failure.
 * @param {Object} success - An API Gateway authorizer response document.
 * @returns {void}
 */

/**
 * An event indicating a request coming into API Gateway that requires authorization.
 *
 * @typedef {Object} ApiGatewayAuthorizationEvent
 * @property {!String} type - The type of authorization that has been requested.
 * @property {!String} authorizationToken - The token to be checked for authentication.
 * @property {!String} methodArn - The ARN of the method which requires authorization.
 */

/**
 * Performs JWT Bearer authentication, and calls the provided callback.
 *
 * @async
 * @function default
 * @param {!ApiGatewayAuthorizationEvent} event - The event that caused this function to be invoked.
 * @param {!Object} context - The context associated with the event.
 * @param {!eventCallback} callback - A function that will be called when authentication succeeds or fails.
 * @returns {!Promise.<void>} - A promise which, when resolved, signals the result of authorization.
 */
export default async function ({ type: eventType, authorizationToken: token, methodArn: arn }, context, callback) {
  // note(cosborn) We're still gonna collect metrics if someone wastes our time.
  const [ , , , , accountId, apiGatewayInfo ] = arn.split(':') // note(cosborn) arn:aws:execute-api:<regionId>:<accountId>:<apiId>/<stage>/<method>/<resourcePath>
  const [ apiId ] = apiGatewayInfo.split('/')
  console.log(JSON.stringify({
    namespace: 'Platform Authorizer',
    accountId,
    apiId
  }))

  if (eventType !== 'TOKEN') { // note(cosborn) Configuration check.
    return callback(MISCONFIGURATION)
  }

  if (!token) { // note(cosborn) The configuration of the authorizer should handle this but sure why not
    return callback(UNAUTHORIZED)
  }

  const [, tokenValue] = token.match(/^Bearer (.*)$/) || [] // note(cosborn) Should also be handled by config.
  const decoded = decode(tokenValue, { complete: true })
  if (!decoded) {
    console.log('Authorization token could not be decoded.', { token })
    return callback(UNAUTHORIZED)
  }

  const { header: { kid } = { } } = decoded
  if (!kid) {
    console.log("No 'kid' found in token header.", { header: decoded.header })
    return callback(UNAUTHORIZED)
  }

  try {
    const key = await client.getSigningKeyAsync(kid)
      .then(({ publicKey, rsaPublicKey }) => publicKey || rsaPublicKey)
    const { sub, scope } = await verifyAsync(tokenValue, key, {
      audience: AUDIENCE,
      issuer: AUTHORITY
    })
    const resp = {
      principalId: sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            // note(cosborn) Tokens are valid for the whole platform, so this doesn't need to be restrictive.
            Resource: 'arn:aws:execute-api:*:*:*/*/*'
          }
        ]
      },
      context: { scope }
    }
    return callback(null, resp)
  } catch (err) {
    console.log('An error occurred validating the token.', { jwksUri, kid, err })
    return callback(UNAUTHORIZED)
  }
}
