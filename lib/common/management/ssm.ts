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
    functions: aws_go_lambda.GoFunction[];
    lambda: aws_go_lambda.GoFunction;
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
    
    props.functions.forEach((func) => {
        param.grantRead(func);
    })
}