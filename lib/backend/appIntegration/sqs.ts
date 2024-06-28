import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    function: cdk.aws_lambda.Function;
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