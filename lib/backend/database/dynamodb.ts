import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface props {
    scope: Construct;
    name: string;
    function: aws_go_lambda.GoFunction;
}

export function newMetaChannelTable(props: props) {
    const table = new cdk.aws_dynamodb.TableV2(props.scope, "id".concat(props.name), {
        // Channel Name
        partitionKey: {
            name: "name",
            type: cdk.aws_dynamodb.AttributeType.STRING
        },

        billing: cdk.aws_dynamodb.Billing.onDemand(),
        // deletionProtection: true,
        dynamoStream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        encryption: cdk.aws_dynamodb.TableEncryptionV2.dynamoOwnedKey(),
        tableName: props.name,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    return table;
}