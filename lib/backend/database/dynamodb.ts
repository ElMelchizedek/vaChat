import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface props {
    scope: Construct;
    name: string;
    function: aws_go_lambda.GoFunction;
}

// TODO: Write newTableGeneric which handles all the codeb below definitions for keys and indexes (as I doubt any table would need them to be different).
// export function newTableGeneric(props: props) {}

export function newChannelTable(props: props) {
    const table = new cdk.aws_dynamodb.TableV2(props.scope, "id".concat(props.name, "ChannelTableSingle"), {
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

    table.grantFullAccess(props.function);

    return table;
}