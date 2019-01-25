/**
 * An authorization lambda function for the Cimpress Mass Customization Platform.
 *
 * @copyright 2018 Cimpress, Inc.
 * @license Apache-2.0
 */

import JwksClient, { SigningKeyNotFoundError } from 'jwks-rsa'
import { decode, verify } from 'jsonwebtoken'
import { DynamoDB } from 'aws-sdk'
import { URL } from 'url'
import { promisify } from 'util'

const { AUDIENCE, AUTHORITY, CACHE_TABLE_NAME } = process.env
const ID = 'key-set'
const MISCONFIGURATION = "This authorizer is not configured as a 'TOKEN' authorizer."
const UNAUTHORIZED = 'Unauthorized'

const dynamo = new DynamoDB.DocumentClient({
  'endpoint': 'http://dynamodb:8000'
})
const jwksUri = new URL('/.well-known/jwks.json', AUTHORITY).toString()
const jwksClient = JwksClient({ jwksUri })

const getSigningKeysAsync = promisify(jwksClient.getSigningKeys.bind(jwksClient))
const verifyAsync = promisify(verify)

/** @type {JwksClient.Jwk[]} */
let memorySigningKeys = []

/**
 * An Amazon Resource Name.
 *
 * @typedef {string} ARN
 */

/**
 * An event indicating a request coming into API Gateway that requires authorization.
 *
 * @typedef {object} ApiGatewayAuthorizationEvent
 * @property {string} authorizationToken The token to be checked for authentication.
 * @property {ARN} methodArn The ARN of the 'execute-api' resource sought.
 * @property {'TOKEN'|'REQUEST'} type The type of authorization that has been requested.
 */

/**
 * A document indicating permissions to invoke resources.
 *
 * @typedef {object} PolicyDocument
 * @property {PolicyStatement[]} Statement The collection of policy statements.
 * @property {string} Version The version of the policy schema.
 */

/**
 * A statement asserting a permission on a resource.
 *
 * @typedef {object} PolicyStatement
 * @property {string|string[]} Action The action(s) on which the permission is asserted.
 * @property {'Allow'|'Deny'} Effect Whether this is an allowed or denied permission.
 * @property {ARN|ARN[]} Resource The resource(s) to which this statement applies.
 */

/**
 * A response coming from API Gateway upon authorization.
 *
 * @typedef {object} ApiGatewayAuthorizationResponse
 * @property {object} context Any additional data associated with the response.
 * @property {PolicyDocument} policyDocument The policy associated with the desired resource.
 * @property {string} principalId The unique identifier of the authorized entity.
 */

/**
 * Performs JWT Bearer authentication, and calls the provided callback.
 *
 * @param {ApiGatewayAuthorizationEvent} event The event that caused this function to be invoked.
 * @returns {Promise.<ApiGatewayAuthorizationResponse>}
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
  const [, tokenValue = ''] = token.match(/^Bearer +(.*)$/u) || []

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
 * @param {ARN} arn The ARN of the 'execute-api' permission sought.
 * @returns {PolicyDocument} A policy document.
 */
export function createPolicyDocument (arn) {
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
        'Resource': `${api}/${stage}/*/*`
      }
    ],
    'Version': '2012-10-17'
  }
}

/**
 * @param {string} kid A key ID.
 * @returns {Promise.<JwksClient.Jwk>} The JWK associated with the provided key ID.
 * @throws {SigningKeyNotFoundError} When the signing key is not found.
 */
async function getSigningKeyAsync (kid) {
  // NOTE(cosborn) Level 1 cache: memory.
  let identifiedKey = memorySigningKeys.find((key) => key.kid === kid)
  if (identifiedKey) {
    return identifiedKey
  }

  // NOTE(cosborn) Level 2 cache: DynamoDB.
  await refreshFromSharedCacheAsync()
  identifiedKey = memorySigningKeys.find((key) => key.kid === kid)
  if (identifiedKey) {
    return identifiedKey
  }

  // NOTE(cosborn) Level 3 cache (???): HTTP.
  await refreshFromSourceAsync()
  identifiedKey = memorySigningKeys.find((key) => key.kid === kid)
  if (identifiedKey) {
    return identifiedKey
  }

  throw new SigningKeyNotFoundError(`Unable to find a signing key that matches '${kid}'`)
}

/**
 * Refreshes the local cache with the signing keys from the remote cache.
 */
async function refreshFromSharedCacheAsync () {
  let signingKeys = []
  try {
    // NOTE(cosborn) Level 2 cache: DynamoDB.
    const dynamoResponse = await dynamo.get({
      'Key': { ID },
      'ProjectionExpression': 'signingKeys',
      'TableName': CACHE_TABLE_NAME
    }).promise()
    signingKeys = dynamoResponse.Item && dynamoResponse.Item.signingKeys
  } catch (err) {
    console.warn('Failed to retrieve keys from DynamoDB; will fall back to HTTP.', { err })
    return
  }

  if (!signingKeys || !signingKeys.length) {
    console.log('No keys in DynamoDB; will fall back to HTTP.')
    return
  }

  // NOTE(cosborn) Write level 2 cache to level 1.
  memorySigningKeys = signingKeys
}

/**
 * Refreshes the remote cache and the local cache with the signing
 * keys from the source.
 */
async function refreshFromSourceAsync () {
  let signingKeys = []
  try {
    signingKeys = await getSigningKeysAsync()
  } catch (err) {
    console.error('Failed to refresh signing keys from source!', { err })
    return
  }

  try {
    // NOTE(cosborn) Write level 3 cache to level 2.
    await dynamo.put({
      'Item': { ID, signingKeys },
      'TableName': CACHE_TABLE_NAME
    }).promise()
  } catch (err) {
    console.warn('Failed to cache keys into DynamoDB; cold starts will suffer.', { err })
    // BECAUSE(cosborn) If Dynamo is down, we want to keep working, just in Cold Mode™.
  }

  // NOTE(cosborn) Write level 3 cache to level 1.
  memorySigningKeys = signingKeys
}
