import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface props {
    scope: Construct;
    name: string;
    fifo: boolean;
}

interface metaProps extends props {
    // subscribers: cdk.aws_sqs.Queue[];
    // subscriberNicknames: string[];
    function: aws_go_lambda.GoFunction;
}

function prettifyDisplayName(input: string): string {
    // Split string based on capital letters.
    const words = input.split(/(?=[A-Z])/);
    // Capitalise the first letter of each word.
    const capitalisedWords = words.map(word => word.charAt(0).toUpperCase() + word.slice(1));
    // Join the words with a space.
    return capitalisedWords.join(' ');
}

function newTopic(props: props) {
    return new cdk.aws_sns.Topic(props.scope, "id".concat(props.name, "Topic"), {
        topicName: props.name,
        displayName: prettifyDisplayName(props.name),
        fifo: props.fifo,
        // enforceSSL: true,
    })
}

export function newMetaTopic(props: metaProps) {
    const rawTopic = newTopic(props);

    rawTopic.grantPublish(props.function);

    return rawTopic;
}