import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CustomProps extends cdk.StackProps {
	channelName: string;
	correspondFunc: cdk.aws_lambda.Function
}

// DynamoDB table of message history for channel.
export class TableChannel extends cdk.Stack {
	public table: cdk.aws_dynamodb.TableV2;
	public corespondFunc: cdk.aws_lambda.Function;

	constructor(scope: Construct, id: string, props: CustomProps) {
		super(scope, id, props);

		const table = new cdk.aws_dynamodb.TableV2(this, "idMsgTable", {
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
			tableName: props?.channelName.concat("Table"),
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		this.table = table;
		this.corespondFunc = props.correspondFunc;

		// Grant permissions to LambdaQueueToTable.
		this.table.grantFullAccess(this.corespondFunc);

	}
}
