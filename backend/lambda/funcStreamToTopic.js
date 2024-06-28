// Triggered when a new record appears in a channel's stream, causing it to send it to the corresponding SNS topic to be read by subscribed clients.
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

exports.handler = async (event) => {
	// console.log(JSON.stringify(event));

	// Parse message stream record contents.
	const messageBody 		= event.Records[0].dynamodb.NewImage;
	const messageContent 	= messageBody.content.S;
	const messageChannel 	= messageBody.channel.S;
	const messageAccount 	= messageBody.account.N;
	const messageTime 		= messageBody.time.N;

	// Attempt to get parameter storing ARN of channel endpoint topic.	
	const clientSSM = new SSMClient({});
	let paramResponse;
	
	console.log("test: ", "channelTopic".concat(messageChannel, "ARN"));

	try {
		const input = {
			Name: "channelTopic".concat(messageChannel, "ARN"),
		};
		const command = new GetParameterCommand(input);
		paramResponse = await clientSSM.send(command);
	} catch (error) {
		console.error("Error executing GetParameterCommand whilst trying to get parameter describing ARN for topic endpoint to publish stream record to: ", error);
	}
	
	console.log(paramResponse);

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