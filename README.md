# API Gateway Platform Authorization

## What It Is

Platform-Authorization is a custom authorizer intended to be used with AWS's API Gateway. API Gateway can use authorizers implemented as Lambda Functions to check authentication and authorization of a request before it passes through the gateway. This custom authorizer is configured out of the box for use with the Cimpress Mass Customization Platform, and can be configured and customized for any particular use.

## Why You Want It

It can be complex to get authentication working for a microservice on the MCP. There are a lot of fiddly little bits to implement in order to ensure that clients' off-the-shelf libraries can work in an automated fashion. Even when these bits are integrated into a development workflow, the difficulty of doing it again for other technologies can begin to entrench a team in their preferred technology stack. Even more, any developers who venture into lesser-known microservice frameworks can find themselves stymied by lack of JWT libraries or even lack of usable crypro libraries for the framework, language, or ecosystem.

## Helpful Links

* Please find [usage guidance][] on the wiki.
* Please find [development guidance][] on the wiki.

[usage guidance]: https://cimpress.githost.io/cosborn/platform-authorizer/wikis/How-To-Use-It
[development guidance]: https://cimpress.githost.io/cosborn/platform-authorizer/wikis/How-to-Develop-It
