import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new SNSClient({
    credentials: fromIni({
        profile: "testing",
        filepath: process.env.HOME + "/.aws/credentials",
        configFilepath: process.env.HOME + "/.aws/config",
    })
});

async function testMsg() {
    try {
        const input = {
            TargetArn: Bun.env.TOPIC_ARN,
            Message: "Hello, world!",
            Subject: "Test",
            MessageAttributes: {
                "guild": {
                    DataType: "String",
                    StringValue: "belfalas"
                }
            },
            MessageGroupId: "testMessageGroup",
            MessageDeduplicationId: "testMessageDedupId",
        }
        const command = new PublishCommand(input);
        const response = await client.send(command);
        console.log(response);
    } catch (error) {
        console.error("Error executing PublishCommand", error);
    }
}

export const main = async() => {
    testMsg();
}

if (import.meta.main) {
    main().then(() => console.log("Done")).catch(err => console.error(err));
}