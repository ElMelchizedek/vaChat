import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface props {
    scope: Construct;
    name: string;
    fifo: boolean;
}

interface metaProps extends props {
    subscribers: cdk.aws_sqs.Queue[];
    subscriberNicknames: string[];
    function: cdk.aws_lambda.Function;
}

interface endpointProps extends props {
    function: cdk.aws_lambda.Function;
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

    props.subscribers.forEach((subscriber, index) => {
        rawTopic.addSubscription(new cdk.aws_sns_subscriptions.SqsSubscription(subscriber, {
            filterPolicy: {
                channel: cdk.aws_sns.SubscriptionFilter.stringFilter({
                    allowlist: [props.subscriberNicknames[index]],
                })
            }
        }));
    });
    
    rawTopic.grantPublish(props.function);

    return rawTopic;
}

export function newEndpointTopic(props: endpointProps) {
    const rawTopic = newTopic(props);

    rawTopic.grantPublish(props.function);

    return rawTopic;
}