import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as customLambda from "./compute/lambda";
import * as customDynamoDB from "./database/dynamodb";
import * as customSNS from "./appIntegration/sns";
import * as customSSM from "../common/management/ssm";
import * as customAPI from "./appIntegration/apiGateway";

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
        // TO DO: Automate this.
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
        const functionDeleteChannel = customLambda.newGoLambda({
            name: "deleteChannel",
            scope: this,
        })
        const functionUpdateChannel = customLambda.newGoLambda({
            name: "updateChannel",
            scope: this,
        })

        // TO DO: Automate this.
        // Give lambdas permissions where necessary.
        const permissionsCreateChannel = new cdk.aws_iam.PolicyStatement({
            actions: [
                // DynamoDB
                'dynamodb:CreateTable',
                'dynamodb:PutItem',
                'dynamodb:DescribeTable',
                'dynamodb:Scan',
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
                'lambda:CreateEventSourceMapping'
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

        const permissionsHandleMessageQueue = new cdk.aws_iam.PolicyStatement({
            actions: [
                // SSM
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
                // SNS
                'sns:Publish',
                // DynamoDB
                'dynamodb:PutItem',
                // SQS
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: ['*'],
        });
        functionHandleMessageQueue.addToRolePolicy(permissionsHandleMessageQueue);

        const permissionsDeleteChannel = new cdk.aws_iam.PolicyStatement({
            actions: [
                // DynamoDB
                'dynamodb:DeleteTable',
                'dynamodb:DeleteItem',
                'dynamodb:DescribeTable',
                'dynamodb:Scan',
                // SNS
                'sns:ListTopics',
                'sns:DeleteTopic',
                // SQS
                'sqs:GetQueueUrl',
                'sqs:DeleteQueue',
                // SSM
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
                // Lambda
                'lambda:ListEventSourceMappings',
                'lambda:DeleteEventSourceMapping',
            ],
            resources: ['*'],
        });
        functionDeleteChannel.addToRolePolicy(permissionsDeleteChannel);

        const permissionsUpdateChannel = new cdk.aws_iam.PolicyStatement({
            actions: [
                // DynamoDB
                'dynamodb:GetItem',
                'dynamodb:UpdateItem',
                'dynamodb:DescribeTable',
                'dynamodb:Scan',
                // SNS
                'sns:SetSubscriptionAttributes',
            ],
            resources: ['*'],
        });
        functionUpdateChannel.addToRolePolicy(permissionsUpdateChannel);
        
        // Add resource-based policy to handleMessageQueue to allow any SQS queue to invoke it.
        functionHandleMessageQueue.addPermission("AllowSQSTrigger", {
            principal: new cdk.aws_iam.ServicePrincipal("sqs.amazonaws.com"),
            action: "lambda:invokeFunction",
            sourceArn: `arn:aws:sqs:${this.region}:${this.account}:*`,
        })
                
        // SNS topic that will filter messages from web server to correct queue for backend pipeline.
        const metaTopic = customSNS.newMetaTopic({
            name: "metaTopic",
            fifo: false,
            scope: this,
            function: functionSendMessage,
        });

        // DynamoDB table for info about every channel.
        const tableMetaChannel = customDynamoDB.newMetaChannelTable({
            name: "MetaChannelTable",
            function: functionGetChannel,
            scope: this,
        });

        // Make metaTopic's ARN a parameter, to be read by the SendMessage lambda so that it can publish to it.
        const metaTopicARN = customSSM.newGenericParamTopicARN({
            name: "MetaTopic",
            topic: metaTopic,
            functions: [functionSendMessage],
            scope: this,
            type: "metaTopic",
        });

        // Make the handleMessageQueue lambda's ARN a parameter, to be read by the createChannel lambda to add an event source to it.
        const handleMessageQueueARN = customSSM.newGenericParamLambdaARN({
            name: "handleMessageQueue",
            lambda: functionHandleMessageQueue,
            scope: this,
        });

        // TODO: Automate definition of functions array.
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
                },
                {
                    name: "deleteChannel",
                    function: functionDeleteChannel,
                },
                {
                    name: "updateChannel",
                    function: functionUpdateChannel,
                }
            ],
            scope: this,
        });

    }
}