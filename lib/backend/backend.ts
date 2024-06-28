import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as customLambda from "./compute/lambda";
import * as customSQS from "./appIntegration/sqs";
import * as customDynamoDB from "./database/dynamodb";
import * as customSNS from "./appIntegration/sns";
import * as customSSM from "../common/management/ssm";

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
        // Lambdas.
        const functionQueueToTable = customLambda.newLambda({
            name: "QueueToTable",
            scope: this,
        });
        const functionStreamToTopic = customLambda.newLambda({
            name: "StreamToTopic",
            scope: this,
        });

        // The ONE queue for testing.
        const queueChannel = customSQS.newChannelQueue({
            name: "Main",
            function: functionQueueToTable,
            scope: this,
        });
        
        // Make the channel queue the event source for QueueToTable.
        functionQueueToTable.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(queueChannel));

        // The ONE DynamoDB table.
        const tableChannel = customDynamoDB.newChannelTable({
            name: "Main",
            function: functionQueueToTable,
            scope: this
        });

        // Make the table stream the event source for StreamToTopic.
        functionStreamToTopic.addEventSource(new cdk.aws_lambda_event_sources.DynamoEventSource(tableChannel, {
            startingPosition: cdk.aws_lambda.StartingPosition.LATEST,
        }));

        // SNS topic that will filter messages from web server to correct queue for backend pipeline.
        const metaTopic = customSNS.newMetaTopic({
            name: "metaTopic",
            subscribers: [queueChannel],
            subscriberNicknames: ["Main"],
            fifo: false,
            scope: this,
        });

        // The ONE endpoint SNS topic.
        const topicChannel = customSNS.newEndpointTopic({
            name: "channelTopicMain",
            fifo: false,
            scope: this,
            function: functionStreamToTopic,
        });

        // The ONE SSM ARN endpoint paramter.
        const topicARN = customSSM.newParamARNChannelTopic({
            name: "Main",
            topic: topicChannel,
            function: functionStreamToTopic,
            scope: this,
        });
    }
}