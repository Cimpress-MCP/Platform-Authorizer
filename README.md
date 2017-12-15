# API Gateway Platform Authorization

## What It Is

Platform-Authorization is a custom authorizer intended to be used with AWS's API Gateway. API Gateway can use authorizers implemented as Lambda Functions to check authentication and authorization of a request before it passes through the gateway. This custom authorizer is meant for use with the Cimpress Mass Customization Platform, and is configured and customized for that.

## Why You Want It

It can be complex to get authentication working for a microservice on the MCP. There are a lot of fiddly little bits to implement in order to ensure that clients' off-the-shelf libraries can work in an automated fashion. Even when these bits are integrated into a development workflow, the difficulty of doing it again for other technologies can begin to entrench a team in their preferred technology stack. Even more, any developers who venture into lesser-known microservice frameworks can find themselves stymied by lack of JWT libraries or even lack of usable crypro libraries for the framework, language, or ecosystem.

## How to Use It

This authorizer is somewhat configurable, and the nature of API Gateway means that the configuration happens at the use site – that is, in the template defining the service using the authorizer.

- Platform Authorizer must be configured as the 'TOKEN' flavor of authorizer. (This is the default.)
  - The identity validation expression should be `/^Bearer [-0-9a-zA-Z\._]*$/`. This allows a request with a malformed `Authorization` header to be failed without invoking even the authorizer.
  - The TTL on the authorization should be set reasonably. 3600 is a reasonable value, for example.
- A 401 `UNAUTHORIZED` Gateway Response is recommended, so that response headers can be set correctly.

None of these requirements are particularly complicated, and can be configured via CloudFormation or Serverless templates.
Here is an excerpt from an example Serverless template:

```yaml
…
functions:
  routeRequest:
    name: request-router
    events:
      - http:
          path: routeRequest
          method: post
          authorizer:
            arn: arn:aws:lambda:eu-west-1:820870426321:function:Platform-Authorization-public-Authorizer
            identityValidationExpression: ^Bearer [-0-9a-zA-Z\._]*$
            resultTtlInSeconds: 3600

resources:
  Resources:
    AuthFailureGatewayResponse:
      Type: AWS::ApiGateway::GatewayResponse
      Properties:
        StatusCode: '401'
        ResponseType: UNAUTHORIZED
        ResponseTemplates:
          application/json: >
            {"message":$context.error.messageString}
        ResponseParameters:
          gatewayresponse.header.WWW-Authenticate: >-
            'Bearer realm="https://api.cimpress.io/", authorization_uri="https://cimpress.auth0.com/oauth/token"'
          gatewayresponse.header.Link: >-
            '<https://cimpress.auth0.com/oauth/token>;rel=authorization_uri'
        RestApiId:
          Ref: 'ApiGatewayRestApi'
…
```

For a service using HTTP integration, the context variable `authorizer.principalId` should be mapped to a custom header so that it can be read by the service. For a service using Lambda Proxy integration, the `authorizer.principalId` is available on the request context to be read directly.

## How to Develop It

This project is written in JavaScript, and primarily uses Node and the Serverless framework as its development tools. If you're already familiar with these tools, go to town! Otherwise, here is a _very_ brief overview.

To begin development, ensure that you have Node and Yarn installed. Install the project's dependencies:

```bash
yarn install
```

To build the project and test it locally, ensure that the file "event.json" has had its metasyntatic variable substituted:

- `authorizationToken`: A valid JWT, in the form "Bearer \<TOKEN CONTENTS>".

Once that is done, the authorizer can be invoked locally:

```bash
sls invoke local -f Authorizer -p ./event.json
```
