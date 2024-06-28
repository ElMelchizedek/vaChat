import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CustomProps extends cdk.StackProps {
    name: string;
    topic: cdk.aws_sns.Topic;
    correspondFunc: cdk.aws_lambda.Function;
}

export class ParamARNChannelTopic extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CustomProps) {
        super(scope, id, props);

        const param = new cdk.aws_ssm.StringParameter(this, ("idParam".concat(props.name)), {
            parameterName: "channelTopic".concat(props.name, "ARN"),
            stringValue: props.topic.topicArn,
        })

        param.grantRead(props.correspondFunc);
    }
}