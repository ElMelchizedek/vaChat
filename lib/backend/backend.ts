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
        const functionHandleMessageQueue = customLambda.newGoLambda({
            name: "handleMessageQueue",
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
        const functionCreateChannel = customLambda.newGoLambda({
            name: "createChannel",
            scope: this,
        })

        // Create parameter for functionHandleMessageQueue's ARN, for use in functionCreateChannel to set up the backend message loop.
        const paramHandleMessageQueueARN = customSSM.newGenericParamLambdaARN({
            name: "handleMessageQueue",
            lambda: functionHandleMessageQueue,
            functions: [functionCreateChannel],
            scope: this,
        })

        // The ONE queue for testing.
        const queueChannel = customSQS.newChannelQueue({
            name: "Main",
            function: functionHandleMessageQueue,
            scope: this,
        });
        
        // Make the channel queue the event source for HandleMessageQueue.
        functionHandleMessageQueue.addEventSource(
            new cdk.aws_lambda_event_sources.SqsEventSource(queueChannel)
        );

        // // DynamoDB table for a channel.
        // const tableChannelMain = customDynamoDB.newChannelTable({
        //     name: "Main",
        //     function: functionHandleMessageQueue,
        //     scope: this
        // });

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

        // // The ONE endpoint SNS topic.
        // const topicChannel = customSNS.newEndpointTopic({
        //     name: "channelTopicMain",
        //     fifo: false,
        //     scope: this,
        //     function: functionHandleMessageQueue,
        // });

        // // The ONE SNS ARN endpoint paramater.
        // const channelTopicARN = customSSM.newGenericParamTopicARN({
        //     name: "Main",
        //     topic: topicChannel,
        //     functions: [functionHandleMessageQueue],
        //     scope: this,
        //     type: "channelTopic",
        // });

        const {integrations, api} = customAPI.newMiddlewareGatewayAPI({
            name: "GatewayWebserverAPI",
            functions: [
                {
                    name: "sendMessage",
                    function: functionSendMessage,
                },
                {
                    name: "getChannel",
                    function: functionGetChannel,
                },
                {
                    name: "createChannel",
                    function: functionCreateChannel,
                }
            ],
            scope: this,
        });

    }
}