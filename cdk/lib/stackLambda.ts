import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class LambdaQueueToTable extends cdk.Stack {
    public func: cdk.aws_lambda.Function;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const fn = new cdk.aws_lambda.Function(this, "idFuncQueueToTable", {
            runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
            handler: "funcQueueToTable.handler",
            code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", )), 
        })

        this.func = fn;
    }
}