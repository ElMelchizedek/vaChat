import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    topic: cdk.aws_sns.Topic;
    functions: cdk.aws_lambda.Function[];
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