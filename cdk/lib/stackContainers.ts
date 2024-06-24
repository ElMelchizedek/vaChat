import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from "aws-cdk-lib/aws-iam";

export class Containers extends cdk.Stack{
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);


    }
}