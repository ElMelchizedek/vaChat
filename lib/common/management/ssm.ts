import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface topicProps {
    scope: Construct;
    name: string;
    topic: cdk.aws_sns.Topic;
    functions: aws_go_lambda.GoFunction[];
    type: string;
}

interface lambdaProps {
    scope: Construct;
    name: string;
    lambda: aws_go_lambda.GoFunction;
}

interface otherProps {
    scope: Construct;
    name: string;
    value: string;
}

export function newGenericParamTopicARN(props: topicProps) {
    const param = new cdk.aws_ssm.StringParameter(props.scope, "idParam".concat(props.name), {
        parameterName: (props.type == "metaTopic" ? props.type.concat("ARN") : props.type.concat(props.name, "ARN")),
        stringValue: props.topic!.topicArn,
    })

    props.functions.forEach((func) => {
        param.grantRead(func);
    });

    return param;
}

export function newGenericParamLambdaARN(props: lambdaProps) {
    const param = new cdk.aws_ssm.StringParameter(props.scope, "idParam".concat(props.name), {
        parameterName: props.name.concat("ARN"),
        stringValue: props.lambda.functionArn,
    })

    return param;
}

export function newGenericParamOther(props: otherProps) {
    const param = new cdk.aws_ssm.StringParameter(props.scope, "idParam".concat(props.name), {
        parameterName: props.name,
        stringValue: props.value,
    })

    return param;
}