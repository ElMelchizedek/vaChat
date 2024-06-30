// Recieves raw messages from a channel's SQS queue, and then transforms it before putting it into the corresponding DynamoDB table.
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

async function sendToTopic(body) {
	// console.log(JSON.stringify(event));

	// Parse message stream record contents.

    const messageContent    = body.Message;
    const messageChannel    = body.MessageAttributes.channel.Value;
    const messageAccount    = body.MessageAttributes.account.Value;
    const messageTime       = body.MessageAttributes.timestamp.Value;

	// Attempt to get parameter storing ARN of channel endpoint topic.	
	const clientSSM = new SSMClient({});
	let paramResponse;
	
	//console.log("test: ", "channelTopic".concat(messageChannel, "ARN"));

	try {
		const input = {
			Name: "channelTopic".concat(messageChannel, "ARN"),
		};
		const command = new GetParameterCommand(input);
		paramResponse = await clientSSM.send(command);
	} catch (error) {
		console.error("Error executing GetParameterCommand whilst trying to get parameter describing ARN for topic endpoint to publish stream record to: ", error);
	}
	
	//console.log(paramResponse);

	// Attempt to publish to channel endpoint topic using its ARN.
	const clientSNS = new SNSClient({});

	try {
		const input = {
			TargetArn: paramResponse.Parameter.Value,
			Message: messageContent,
			MessageAttributes: {
				"account": {
					DataType: "Number",
					StringValue: messageAccount,
				},
				"timestamp": {
					DataType: "Number",
					StringValue: messageTime,
				}
			},
		}
		const command = new PublishCommand(input);
		const response = await clientSNS.send(command);
		console.log(response);
	} catch (error) {
		console.error("Error executing PublishCommand whilst trying to push parsed stream record to channel endpoint topic: ", error);
	}
}

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

    // Attempt to push message from queue to table.
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
        // return response;
        console.log("DynamoDB\n", response);
    } catch (error) {
        console.error("Error executing PutCommand whilst trying to move channel SQS message to corresponding DynamoDB table: ", error);
    }

    // Attempt to push same queue message to endpoint SNS topic.
    await sendToTopic(body);
}