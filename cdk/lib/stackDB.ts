import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class TableMessage extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  
    const table = new dynamodb.TableV2(this, "idMsgTable", {
      partitionKey: {
        name: "accountName",
        type: dynamodb.AttributeType.STRING
      },
      // Uses UNIX epoch
      sortKey: {
        name: "time",
        type: dynamodb.AttributeType.NUMBER
      },
      billing: dynamodb.Billing.onDemand(),
      // deletionProtection: true,
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
      encryption: dynamodb.TableEncryptionV2.dynamoOwnedKey(),
      tableName: "msgTable",
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
  }
}