/**
 * An metrics reporter lambda function for the Platform Authorizer.
 * @copyright 2018 Cimpress, Inc.
 */

import { CloudWatch } from 'aws-sdk'
import { promisify } from 'bluebird'
import { Buffer } from 'buffer'
import { gunzip } from 'zlib'

const client = new CloudWatch()
const gunzipAsync = promisify(gunzip)

const metric = {
  MetricName: 'UseCount',
  Value: 1
}

/**
 * A container for CloudWatch log data.
 *
 * @typedef {Object} AwsLogs
 * @property {!String} data - The contents of the log message, gzipped and Base64 encoded.
 */

/**
 * An event indicating a log message being written to CloudWatch that optionally matches the supplied filter.
 *
 * @typedef {Object} CloudWatchLogEvent
 * @property {!AwsLogs} awslogs - A container for the log data.
 */

/**
 * Reports metrics as written to CloudWatch.
 *
 * @async
 * @function default
 * @param {!CloudWatchLogEvent} event - The event that caused this function to be invoked.
 * @returns {!Promise.<void>} - A promise which, when resolved, signals the result of authorization.
 */
export default async function ({ awslogs: { data: input } }) {
  const { logEvents } = await gunzipAsync(Buffer.from(input, 'base64'))
    .then(r => r.toString('utf8'))
    .then(JSON.parse)

  const metricData = logEvents
    .map(({ message }) => message.split('\t')) // note(cosborn) Strip λ preamble.
    .map(([ , , event ]) => JSON.parse(event))
    .map(({ methodArn }) => methodArn.split(':')) // note(cosborn) arn:aws:execute-api:<regionId>:<accountId>:<apiId>/<stage>/<method>/<resourcePath>
    .map(([ , , , , accountId, apiGatewayInfo ]) => [ accountId, ...apiGatewayInfo.split('/') ])
    .map(([ accountId, apiId ]) => [
      {
        Dimensions: [
          {
            Name: 'Account',
            Value: accountId
          }
        ]
      },
      {
        Dimensions: [
          {
            Name: 'Account',
            Value: accountId
          },
          {
            Name: 'API',
            Value: apiId
          }
        ]
      }
    ]).reduce((a, b) => a.concat(b), []) // flatMap
    .map(ds => Object.assign({}, metric, ds))

  return client.putMetricData({
    MetricData: metricData,
    Namespace: 'Platform Authorizer'
  }).promise()
}
