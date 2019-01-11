/**
 * An authorization lambda function for the Cimpress Mass Customization Platform.
 *
 * @copyright 2018 Cimpress, Inc.
 * @license Apache-2.0
 */

import { decode, verify } from 'jsonwebtoken'
import JwksClient from 'jwks-rsa'
import { URL } from 'url'
import { promisify } from 'util'

const { AUDIENCE, AUTHORITY } = process.env
const MISCONFIGURATION = "This authorizer is not configured as a 'TOKEN' authorizer."
const UNAUTHORIZED = 'Unauthorized'

const jwksUri = new URL('/.well-known/jwks.json', AUTHORITY)
const client = JwksClient({
  'cache': true,
  jwksUri,
  'rateLimit': true
})
const getSigningKeyAsync = promisify(client.getSigningKey.bind(client))
const verifyAsync = promisify(verify)

/**
 * An Amazon Resource Name.
 *
 * @typedef {String} ARN
 */

/**
 * An event indicating a request coming into API Gateway that requires authorization.
 *
 * @typedef {Object} ApiGatewayAuthorizationEvent
 * @property {!String} authorizationToken The token to be checked for authentication.
 * @property {!ARN} methodArn The ARN of the 'execute-api' resource sought.
 * @property {'TOKEN'|'REQUEST'} type The type of authorization that has been requested.
 */

/**
 * A document indicating permissions to invoke resources.
 *
 * @typedef {Object} PolicyDocument
 * @property {!Array.<!PolicyStatement>} Statement The collection of policy statements.
 * @property {!String} Version The version of the policy schema.
 */

/**
 * A statement asserting a permission on a resource.
 *
 * @typedef {Object} PolicyStatement
 * @property {!String|!Array.<!String>} Action The action(s) on which the permission is asserted.
 * @property {'Allow'|'Deny'} Effect Whether this is an allowed or denied permission.
 * @property {!ARN|!Array.<!ARN>} Resource The resource(s) to which this statement applies.
 */

/**
 * A response coming from API Gateway upon authorization.
 *
 * @typedef {Object} ApiGatewayAuthorizationResponse
 * @property {Object} context Any additional data associated with the response.
 * @property {!PolicyDocument} policyDocument The policy associated with the desired resource.
 * @property {!String} principalId The unique identifier of the authorized entity.
 */

/**
 * Performs JWT Bearer authentication, and calls the provided callback.
 *
 * @param {!ApiGatewayAuthorizationEvent} event The event that caused this function to be invoked.
 * @returns {!Promise.<!ApiGatewayAuthorizationResponse>}
 *   A promise which, when resolved, signals the result of authorization.
 */
export default async function ({ 'authorizationToken': token, 'methodArn': arn, 'type': eventType }) {
  // BECAUSE(cosborn) Fail-fast configuration check.
  if (eventType !== 'TOKEN') {
    throw MISCONFIGURATION
  }

  // BECAUSE(cosborn) The configuration of the authorizer should handle this but sure why not
  if (!token) {
    throw UNAUTHORIZED
  }

  // NOTE(cosborn) Should also be handled by config.
  const [, tokenValue] = token.match(/^Bearer +(.*)$/u) || []
  const decoded = decode(tokenValue, { 'complete': true })
  if (!decoded) {
    console.log('Authorization token could not be decoded.', { token })
    throw UNAUTHORIZED
  }

  const { 'header': { kid } = { } } = decoded
  if (!kid) {
    console.log("No 'kid' found in token header.", { 'header': decoded.header })
    throw UNAUTHORIZED
  }

  try {
    const key = await getSigningKeyAsync(kid)
      .then(({ publicKey, rsaPublicKey }) => publicKey || rsaPublicKey)
    const { 'sub': principalId, scope } = await verifyAsync(tokenValue, key, {
      'audience': AUDIENCE,
      'issuer': AUTHORITY
    })
    return {
      'context': { scope },
      'policyDocument': createPolicyDocument(arn),
      principalId
    }
  } catch (err) {
    console.log('An error occurred validating the token.', { err, jwksUri, kid })
    throw UNAUTHORIZED
  }
}

/**
 * Transforms an 'execute-api' resource into a policy document indicating
 * authorization to invoke any endpoint in the current stage of the API.
 *
 * @param {!ARN} arn The ARN of the 'execute-api' permission sought.
 * @returns {!PolicyDocument} A policy document.
 */
export const createPolicyDocument = (arn) => {
  // NOTE(cosborn) Everything after stage is discarded.
  const [
    api,
    stage
  ] = arn.split('/', 2)
  return {
    'Statement': [
      {
        'Action': 'execute-api:Invoke',
        'Effect': 'Allow',
        // NOTE(cosborn) Tokens are valid for the whole stage, so this doesn't need to be restrictive.
        'Resource': `${api}/${stage}/*`
      }
    ],
    'Version': '2012-10-17'
  }
}
