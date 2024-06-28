import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    function: cdk.aws_lambda.Function;
}

export function newChannelTable(props: props) {
    const table = new cdk.aws_dynamodb.TableV2(props.scope, "id".concat(props.name, "ChannelTable"), {
        // Account ID
        partitionKey: {
            name: "account",
            type: cdk.aws_dynamodb.AttributeType.NUMBER,
        },
        // Uses UNIX epoch
        sortKey: {
            name: "time",
            type: cdk.aws_dynamodb.AttributeType.NUMBER
        },

        globalSecondaryIndexes: [
            {
                indexName: "accountContent",
                partitionKey: {
                    name: "account",
                    type: cdk.aws_dynamodb.AttributeType.NUMBER,
                },
                sortKey: {
                    name: "content",
                    type: cdk.aws_dynamodb.AttributeType.STRING,
                }
            },
        ],

        billing: cdk.aws_dynamodb.Billing.onDemand(),
        // deletionProtection: true,
        dynamoStream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        encryption: cdk.aws_dynamodb.TableEncryptionV2.dynamoOwnedKey(),
        tableName: props.name.concat("Table"),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.grantFullAccess(props.function);

    return table;
}