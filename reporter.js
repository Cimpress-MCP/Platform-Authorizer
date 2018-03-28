/**
 * An metrics reporter lambda function for the Platform Authorizer.
 *
 * @copyright 2018 Cimpress, Inc.
 * @license Apache-2.0
 */

'use strict'

import { CloudWatch } from 'aws-sdk'
import { promisify } from 'es6-promisify'
import { Buffer } from 'buffer'
import { gunzip } from 'zlib'

const client = new CloudWatch()
const gunzipAsync = promisify(gunzip)
const METRIC_INVARIANTS = {
  MetricName: 'UseCount',
  Value: 1
}

/**
 * A container for CloudWatch log data.
 *
 * @typedef {Object} AwsLogs
 * @property {!String} data The contents of the log message, gzipped and Base64 encoded.
 */

/**
 * An event indicating a log message being written to CloudWatch that optionally matches the supplied filter.
 *
 * @typedef {Object} CloudWatchLogEvent
 * @property {!AwsLogs} awslogs A container for the log data.
 */

/**
 * Reports metrics as written to CloudWatch.
 *
 * @param {!CloudWatchLogEvent} event The event that caused this function to be invoked.
 * @param {!AwsLogs} event.awslogs The event that caused this function to be invoked.
 * @param {!String} event.awslogs.data The contents of the log message, gzipped and Base64 encoded.
 * @returns {!Promise.<Object>} A promise which, when resolved, signals the result of reporting.
 */
export default async function ({ awslogs: { data: input } }) {
  const { logEvents } = await gunzipAsync(Buffer.from(input, 'base64'))
    .then(r => r.toString('utf8'))
    .then(JSON.parse)

  const MetricData = logEvents
    .map(JSON.parse)
    // note(cosborn) arn:aws:execute-api:<regionId>:<accountId>:<apiId>/authorizers/<resourceId>
    .map(({ requestParameters: { sourceArn } }) => sourceArn.split(':'))
    .map(([ , , , , accountId, authorizerInfo ]) => [ accountId, ...authorizerInfo.split('/') ])
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
    .map(ds => ({ ...METRIC_INVARIANTS, ...ds }))

  return client.putMetricData({
    Namespace: 'Platform Authorizer',
    MetricData
  }).promise()
}
