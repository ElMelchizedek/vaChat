// Recieves raw messages from a channel's SQS queue, and then transforms it before putting it into the corresponding DynamoDB table.

const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

exports.handler = async (event)  => {
    // Debug logging.
    console.log("Event\n", JSON.stringify(event), "\n");
    console.log("Context\n", JSON.stringify(event), "\n");
    
    const body = JSON.parse(event.Records[0].body);
    console.log("Body\n", body);
    console.log("Attributes\n", body.MessageAttributes);

    const messageContent    = body.Message;
    const messageChannel    = body.MessageAttributes.channel.Value;
    const messageAccount    = body.MessageAttributes.account.Value;
    const messageTime       = body.MessageAttributes.timestamp.Value;

    const DBClient = new DynamoDBClient({});

    try {
        const command = new PutItemCommand({
            TableName: messageChannel.concat("Table"),
            Item: {
                channel: {
                    "S": messageChannel
                },
                account: {
                    "N": messageAccount
                },
                time: {
                    "N": messageTime
                },
                content: {
                    "S": messageContent
                }
            }
        });
        const response = await DBClient.send(command);
        return response;
    } catch (error) {
        console.error("Error executing PutCommand whilst trying to move channel SQS message to corresponding DynamoDB table: ", error);
    }
}