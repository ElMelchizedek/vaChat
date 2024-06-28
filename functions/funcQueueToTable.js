const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const client = new SNSClient({});

async function sendMsg(messageContents, ARN) {
    try {
        const input = {
            TargetArn: "arn:aws:sns:ap-southeast-2:891377059446:metaTopic",
            Message: messageContents.message,
            MessageAttributes: {
                "channel": {
                    DataType: "String",
                    StringValue: messageContents.channel,
                },
                "account": {
                    DataType: "Number",
                    StringValue: messageContents.account,
                },
                "timestamp": {
                    DataType: "Number",
                    StringValue: messageContents.sentTime,
                }
            },
        }
        const command = new PublishCommand(input);
        const response = await client.send(command);
        console.log(response);
    } catch (error) {
        console.error("Error executing PublishCommand", error);
    }
}

async function getMetaTopicARN(sentChannel) {
    const clientSSM = new SSMClient({});
    let paramResponse;

    try {
        const input = {
            Name: "metaTopic".concat(sentChannel, "ARN")
        };
        const command = new GetParameterCommand(input);
        paramResponse = await clientSSM.send(command);
    } catch (error) {
        console.error("Error executing GetParameterCommand", error);
    }
}

exports.handler = async (event) => {
    const rawContents = JSON.parse(event.body);
    const contents = {
        "message": rawContents.message,
        "channel": rawContents.channel,
        "account": rawContents.account,
        "timestamp": rawContents.timestamp,
    };

    const metaTopicARN = getMetaTopicARN(contents.channel)
    const response = await sendMsg(contents, metaTopicARN);
    console.log(response);
};