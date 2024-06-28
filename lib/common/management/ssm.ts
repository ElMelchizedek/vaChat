import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    topic: cdk.aws_sns.Topic;
    function: cdk.aws_lambda.Function;
}

export function newParamARNChannelTopic(props: props) {
    const param = new cdk.aws_ssm.StringParameter(props.scope, "idParam".concat(props.name), {
        parameterName: "channelTopic".concat(props.name, "ARN"),
        stringValue: props.topic.topicArn,
    })

    param.grantRead(props.function);

    return param;
}