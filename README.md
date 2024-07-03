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

## Roadmap
### v0.1.0 (COMPLETE)
* Rudimentary and basic one-to-one, single-channel messaging functionality.
### v0.2.0
* Ability to create and choose channels.
### v0.3.0
* Integration of webserver code into a CDK-conducted ECS deployment.
### v0.4.0
* Authentication with accounts.
* Account-level control of access to channels by their creators.