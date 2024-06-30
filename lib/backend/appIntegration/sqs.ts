import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface props {
    scope: Construct;
    name: string;
    function: aws_go_lambda.GoFunction;
}

export function newChannelQueue(props: props) {
    const queue = new cdk.aws_sqs.Queue(props.scope, "id".concat(props.name, "ChannelQueue"), {
        queueName: [props.name.toLowerCase(), "Channel", "Queue"].join(""),
        // fifo: true,
        // enforceSSL: true,
    });

    queue.grantConsumeMessages(props.function);

    return queue;
}