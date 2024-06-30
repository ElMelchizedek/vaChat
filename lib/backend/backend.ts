import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as customLambda from "./compute/lambda";
import * as customSQS from "./appIntegration/sqs";
import * as customDynamoDB from "./database/dynamodb";
import * as customSNS from "./appIntegration/sns";
import * as customSSM from "../common/management/ssm";
import * as customAPI from "./appIntegration/apiGateway";

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
        // Lambdas.
        const functionQueueToTable = customLambda.newLambda({
            name: "QueueToTable",
            scope: this,
        });
        const functionSendMessage = customLambda.newGoLambda({
            name: "sendMessage",
            scope: this,
        })
        const functionGetChannel = customLambda.newGoLambda({
            name: "getChannel",
            scope: this,
        })

        // The ONE queue for testing.
        const queueChannel = customSQS.newChannelQueue({
            name: "Main",
            function: functionQueueToTable,
            scope: this,
        });
        
        // Make the channel queue the event source for QueueToTable.
        functionQueueToTable.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(queueChannel));

        // DynamoDB table for a channel.
        const tableChannelMain = customDynamoDB.newChannelTable({
            name: "Main",
            function: functionHandleMessageQueue,
            scope: this
        });

        // DynamoDB table for info about every channel.
        const tableMetaChannel = customDynamoDB.newMetaChannelTable({
            name: "MetaChannelTable",
            function: functionGetChannel,
            scope: this,
        })

        // SNS topic that will filter messages from web server to correct queue for backend pipeline.
        const metaTopic = customSNS.newMetaTopic({
            name: "metaTopic",
            subscribers: [queueChannel],
            subscriberNicknames: ["Main"],
            fifo: false,
            scope: this,
            function: functionSendMessage,
        });

        // Make metaTopic's ARN a parameter, to be read by the SendMessage lambda so that it can publish to it.
        const metaTopicARN = customSSM.newGenericParamTopicARN({
            name: "MetaTopic",
            topic: metaTopic,
            functions: [functionSendMessage],
            scope: this,
            type: "metaTopic",
        })

        // The ONE endpoint SNS topic.
        const topicChannel = customSNS.newEndpointTopic({
            name: "channelTopicMain",
            fifo: false,
            scope: this,
            function: functionQueueToTable,
        });

        // The ONE SNS ARN endpoint paramater.
        const channelTopicARN = customSSM.newGenericParamTopicARN({
            name: "Main",
            topic: topicChannel,
            functions: [functionQueueToTable],
            scope: this,
            type: "channelTopic",
        });

        const {integration, api} = customAPI.newMiddlewareGatewayAPI({
            name: "GatewayWebserverAPI",
            functions: [
                {
                    name: "sendMessage",
                    function: functionSendMessage,
                },
                {
                    name: "getChannel",
                    function: functionGetChannel,
                }
            ],
            scope: this,
        });

    }
}