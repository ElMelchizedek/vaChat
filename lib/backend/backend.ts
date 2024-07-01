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

        // Give lambdas permissions where necessary.
        const permissionsCreateChannel = new cdk.aws_iam.PolicyStatement({
            actions: [
                // DynamoDB
                'dynamodb:CreateTable',
                'dynamodb:PutItem',
                // SQS
                'sqs:CreateQueue',
                'sqs:GetQueueAttributes',
                // SNS
                'sns:ListTopics',
                'sns:Subscribe',
                'sns:CreateTopic',
                // SSM
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
                // Lambda
                'lambda:AddPermission'
            ],
            resources: ['*'],
        });
        functionCreateChannel.addToRolePolicy(permissionsCreateChannel);

        const permissionsSendMessage = new cdk.aws_iam.PolicyStatement({
            actions: [
                // SSM
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
            ],
            resources: ['*'],
        })
        functionSendMessage.addToRolePolicy(permissionsSendMessage);

        const permissionsGetChannel = new cdk.aws_iam.PolicyStatement({
            actions: [
                // DynamoDB
                'dynamodb:Scan',
            ],
            resources: ['*'],
        });
        functionGetChannel.addToRolePolicy(permissionsGetChannel);
                

        // DynamoDB table for info about every channel.
        const tableMetaChannel = customDynamoDB.newMetaChannelTable({
            name: "MetaChannelTable",
            function: functionGetChannel,
            scope: this,
        })

        // SNS topic that will filter messages from web server to correct queue for backend pipeline.
        const metaTopic = customSNS.newMetaTopic({
            name: "metaTopic",
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