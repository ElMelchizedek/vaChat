import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface props {
    scope: Construct;
    name: string;
    topic: cdk.aws_sns.Topic;
    functions: aws_go_lambda.GoFunction[];
    type: string;
}

export function newGenericParamTopicARN(props: props) {
    const param = new cdk.aws_ssm.StringParameter(props.scope, "idParam".concat(props.name), {
        parameterName: props.type.concat(props.name, "ARN"),
        stringValue: props.topic.topicArn,
    })

    props.functions.forEach((func) => {
        param.grantRead(func);
    });

    return param;
}