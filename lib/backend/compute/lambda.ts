import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface props {
    scope: Construct;
    name: string;
}

export function newLambda(props: props) {
    return new cdk.aws_lambda.Function(props.scope, "id".concat(props.name, "LambdaFunction"), {
        runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
        handler: "func".concat(props.name, ".handler"),
        code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, "..", "..", "..", "functions")),
    });
}