const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

// #### /getChannel
// **Input**
// ```http
// {ApiGatewayURL}/getChannel?type[single|all]
// ```
// **Output**
// ```json
// [
//     {
//         "EndpointTopicARN": {
//             "Value": "arn:aws:sns:{region}:{account}:{Name}EndpointTopic"
//         },
//         "Name": {
//             "Value": string
//         },
//         "QueueARN": {
//             "Value": "arn:aws:sqs:{region}:{account}:{Name}ChannelQueue" 
//         },
//         "TableARN": {
//             "Value": "arn:aws:dynamodb:{region}:{acount}:table/{Name}table" 
//         }
//     },
//     ...
// ]
// ```

export type ChannelInfo = {
    Name: { Value: string }
    EndpointTopicARN: { Value: string }
    QueueARN: { Value: string }
    TableARN: { Value: string }
}[]

export const getChannels = async () =>
    await fetch(`${url}/getChannel/?type=all`, { method: "GET" })
        .then(response => response.json())
        .then(data => data.channels as ChannelInfo)
        .catch(error => console.error(error))