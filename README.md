# vaChat

## API Documentation

### Backend

#### /createChannel

**Input**

```json
{
    "name": string
}
```

**Output**

```json
{
    "EndpointTopicARN": "arn:aws:sns:{region}:{account}:{Name}EndpointTopic",
    "Name": string,
    "QueueARN": "arn:aws:sqs:{region}:{account}:{Name}ChannelQueue",
    "TableARN": "arn:aws:dynamodb:{region}:{acount}:table/{Name}table"
}
```

#### /getChannel

**Input**

```http
{ApiGatewayURL}/getChannel?type[single|all]
```

**Output**

```json
[
    {
        "EndpointTopicARN": {
            "Value": "arn:aws:sns:{region}:{account}:{Name}EndpointTopic"
        },
        "Name": {
            "Value": string
        },
        "QueueARN": {
            "Value": "arn:aws:sqs:{region}:{account}:{Name}ChannelQueue" 
        },
        "TableARN": {
            "Value": "arn:aws:dynamodb:{region}:{acount}:table/{Name}table" 
        }
    },
    ...
]
```

#### /sendMessage

**Input**

```json
{
    "channel": string,
    "account": string(number),
    "timestamp": string(number),
    "message": string
}
```

**Output**

```
nil
```

## Webserver Documentation

### main.tsx

Main entry point for the webserver. Uses an [Elysia](https://elysiajs.com) instance to manage the server. Uses plugins from `websockets/` and `backend-integration/` to compose the server.

### websockets/

#### client.tsx

Defines a class that manages a client's websocket connection to the server. It is responsible for sending information to the client, and for managing a client's state on the server.

#### websocketEndpoint.ts

Exports a plugin that provides an endpoint for a websocket connection. Handles when a connection is opened, closed, or when a message is received from the client.

#### index.ts

Re-exports all exported members of the `websockets/` directory, such that they can be imported from the `webserver` directory like so:

```typescript
import { ... } from './websockets';
```

### backend-integration/

#### create-channel.ts

Exports a function that will create a channel via sending a web request to `{API Gateway URL}/createChannel`.

#### get-channel.ts

Exports a function that will get a list of all channels via sending a web request to `{API Gateway URL}/getChannel`.

#### submit-message.ts

Exports a function that will send a message to a channel via sending a web request to `{API Gateway URL}/sendMessage`.

#### sns.ts

Exports an endpoint that will listen for messages from SNS topics. This is used to send messages to clients connected to the server. Also exports a function that will send a subscription request to an SNS topic.

#### credentials.ts

Exports an `AwsCredentialIdentityProvider` function that will provide AWS credentials to an AWS SDK client interface.

#### index.ts

Re-exports all exported members of the `backend-integration/` directory, such that they can be imported from the `backend-integration` directory like so:

```typescript
import { ... } from './backend-integration';
```

## Roadmap

### v0.1.0 (COMPLETE)

* Rudimentary and basic one-to-one, single-channel messaging functionality.

### v0.2.0

* Ability to manage (CRUD) channels from the webserver, with channel-specific message history and client connections.

### v0.3.0

* Integrate webserver code into the file structure. 
* Will require setting up the code to be managed and deployed by CDK within an ECS cluster.

### v0.4.0

* Provide the ability to differentiate connecting users by a user-managed account.
* Allow for user-control of their access to channels (self-managed subscriptions).