import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { DynamoDBStreamsClient, ListStreamsCommand, GetShardIteratorCommand, DescribeStreamCommand, GetRecordsCommand, type _Record, type GetRecordsCommandOutput} from "@aws-sdk/client-dynamodb-streams";

console.log("Setting up AWS credentials...");

const DBClient = new DynamoDBClient({
    credentials: fromIni({
        profile: "testing", // Change later
        filepath: process.env.HOME + "/.aws/credentials",
        configFilepath: process.env.HOME + "/.aws/config",
    })
});

const StreamsClient = new DynamoDBStreamsClient({
    credentials: fromIni({
        profile: "testing", // Change later
        filepath: process.env.HOME + "/.aws/credentials",
        configFilepath: process.env.HOME + "/.aws/config",
    })
});

const docClient = DynamoDBDocumentClient.from(DBClient);

async function putFunc() {
    try {
        const command = new PutCommand({
            TableName: "protoMsgTable",
            Item: {
                accountName: "admin",
                time: Date.now(),
                message: "Hello, world!",
            }
        });

        const response = await docClient.send(command);
        // console.log("PutCommand response:", response);
    } catch (error) {
        console.error("Error executing PutCommand:", error);
    }
}

async function getStreamFunc() {
    try {
        const command = new ListStreamsCommand({
            TableName: "protoMsgTable",
        });

        const response = await StreamsClient.send(command);
        // console.log("ListStreamsCommand response:", response);
        const streamArn = response.Streams?.[0]?.StreamArn;
        return streamArn;
    } catch (error) {
        console.error("Error executing ListStreamsComand:", error);
    }

}

async function describeStreamFunc(streamArn: string) {
    try {

        const command = new DescribeStreamCommand({
            StreamArn: streamArn
        });
        const response = await StreamsClient.send(command);
        // console.log("DescribeStreamCommand response:", response);
        const shards = response.StreamDescription?.Shards;
        return shards;
    } catch (error) {
        console.error("Error executing DescribeStreamCommand", error);
    }
}

async function getShardIterateFunc(streamArn: string, shardId: string) {
    try {
        const command = new GetShardIteratorCommand({
            StreamArn: streamArn,
            ShardId: shardId,
            ShardIteratorType: "TRIM_HORIZON"
        });
        const response = await StreamsClient.send(command);
        // console.log("GetShardIteratorCommand response:", response);
        const iterate = response.ShardIterator;
        return iterate;
    } catch (error) {
        console.error("Error executing GetShardIteratorCommand:", error);
    }

}

async function getRecordsFunc(shardIterate: string) {
    try {
        const command = new GetRecordsCommand({
            ShardIterator: shardIterate,
        });
        const response = await StreamsClient.send(command);
        // console.log("GetRecordsCommand response:", response);
        return response;
    } catch (error) {
        console.error("Error executing GetRecordsCommand:", error);
    }
}

function parseRecord(recordEntry: _Record) {
    const rawTime = recordEntry.dynamodb?.NewImage?.time.N;
    if (!rawTime) {
        console.log("GetRecordCommand response element's time entry is undefined.");
        return;
    }
    const humanTime = new Date(parseInt(rawTime)).toLocaleString("en-AU");

    console.log("*** RECORD ***\n");
    console.log("Account:", recordEntry.dynamodb?.NewImage?.accountName?.S);
    console.log("Timestamp:", humanTime);
    console.log("Contents:", recordEntry.dynamodb?.NewImage?.message?.S,);
    console.log("\n")
    return;
}

async function recordLoop(rawRecords: GetRecordsCommandOutput, { timeLimit, startTime} : {timeLimit: number, startTime: number}) {
    if (!rawRecords?.Records) {
        console.error("GetRecordsCommand response is undefined.");
        return;
    }
    const records = rawRecords.Records;
    records.forEach((recordEntry) => {
        if (!recordEntry) {
            console.error("GetRecordCommand response element is undefined.");
            return;
        }
        parseRecord(recordEntry);
    })
    if (!rawRecords.NextShardIterator) {
        return;
    }

    const currentTime = Date.now();
    if (currentTime - startTime > timeLimit) {
        console.log("Time limit exceeded. Stopping recordLoop.");
        return;
    }

    const newRecords = await getRecordsFunc(rawRecords.NextShardIterator);
    if (!newRecords) {
        console.error("GetRecordCommand response is undefined.");
        return;
    }
    await recordLoop(newRecords, {timeLimit, startTime});
    return;
}

async function newStart() {
    // putFunc();
    const timeKeeping = {
        timeLimit: 2000,
        startTime: Date.now(),
    };

    const streamArn = await getStreamFunc();
    if (!streamArn) {
        console.error("ListStreamsCommand response is undefined.");
        return;
    }
    const shards = await describeStreamFunc(streamArn);
    if (!shards) {
        console.error("DescribeStreamCommand response is undefined.");
        return;
    }

    shards.forEach(async(shardEntry) => {
        if (!shardEntry.ShardId) {
            console.error("shardId in DescribeStreamCommand response's entry is undefined");
            return;
        }
        const iterate = await getShardIterateFunc(streamArn, shardEntry.ShardId);
        if (!iterate) {
            console.error("GetShardIteratorCommand response is undefined.");
            return;
        }
        let records = await getRecordsFunc(iterate);
        if (!records) {
            console.error("GetRecordCommand response is undefined.");
            return;
        }
        recordLoop(records, timeKeeping);
        return;
    })
} 

export const main = async () => {
    newStart();
};

if (import.meta.main) {
    main().then(() => console.log("Done")).catch(err => console.error(err));
}