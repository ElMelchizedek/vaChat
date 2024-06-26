// Recieves raw messages from a channel's SQS queue, and then transforms it before putting it into the corresponding DynamoDB table.

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event, context) => {
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
        const command = new PutCommand({
            TableName: messageChannel.concat("Table"),
            Item: {
                account: Number(messageAccount),
                time: Number(messageTime),
                content: String(messageContent),
            }
        });

        const response = await DBClient.send(command);
    } catch (error) {
        console.error("Error executing PutCommand whilst trying to move channel SQS message to corresponding DynamoDB table: ", error);
    }
}