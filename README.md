# vaChat


## API Documentation
### Backend

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

#### /deleteChannel
**Input**
```json
{
    "name": string
}
```
**Output**
```
nil
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