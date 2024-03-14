## Version 4.0.1 (Released 2023-08-29)

- The authorizer's runtime has been updated to Node 18.
- BREAKING: The authorizer now supports multiple issuers.
  - These are called ISSUERS now, deprecating AUTHORITY.

## Version 3.0.0 (Released 2021-11-07)

- The authorizer's deployment size has been significantly reduced due to new depdendencies.
- The `sub` of the JWT is supplied as the `usageIdentifierKey` for rate-limiting and other purposes.
- The conditions of the permissions to decrypt environment variables (if environment variables are encrypted) conforms to new AWS advice.

## Version 2.3.0 (Released 2020-??-??)

- The authorizer's runtime has been updated to Node 14.

## Version 2.2.0 (Released 2020-10-06)

- The authorizer's runtime has been updated to Node 12.
- The application optionally accepts the ARN of a KMS key with which to encrypt Lambda Function environment variables.

## Version 2.1.0 (Released 2019-05-15)

- The authorizer's runtime has been updated to Node 10.
- Performance improvements have been applied, such no longer needing to decode a token twice.

## Version 2.0.0 (Released 2019-01-11)

- The authorizer is now available on the Serverless Application Repository.

## Version 1.4.0 (Released 2018-04-04)

- The authorizer's runtime has been updated to Node 8.

## Version 1.3.0 (Released 2018-03-28)

- The authorizer now uses CloudTrail to gather metrics.

## Version 1.2.0 (Released 2018-01-23)

- The authorizer can be used with API Gateway caching.

## Version 1.0.0 (Released 2017-12-15)

- Everything is new!
