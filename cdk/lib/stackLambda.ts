import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface PropsCustomLambda extends cdk.StackProps {
    name: string;
}

export class CustomLambda extends cdk.Stack {
    public func: cdk.aws_lambda.Function;

    constructor(scope: Construct, id: string, props: PropsCustomLambda) {
        super(scope, id, props);

        const fn = new cdk.aws_lambda.Function(this, "id".concat(props.name), {
            runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
            handler: "func".concat(props.name, ".handler"),
            code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, "..", "lambda")),
        })
    }
}