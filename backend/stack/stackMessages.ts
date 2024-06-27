import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface SharedCustomProps extends cdk.StackProps {
    name: string;
}

interface TopicProps extends SharedCustomProps {
    subscribers?: cdk.aws_sqs.IQueue[]; 
    subscribersParents?: QueueMessage[];
    fifo: boolean;
}

interface QueueProps extends SharedCustomProps {
    type: string;
    nickname: string;
    correspondFunc: cdk.aws_lambda.Function;
}

function prettifyDisplayName(input: string): string {
    // Split string based on capital letters.
    const words = input.split(/(?=[A-Z])/);
    // Capitalise the first letter of each word.
    const capitalisedWords = words.map(word => word.charAt(0).toUpperCase() + word.slice(1));
    // Join the words with a space.
    return capitalisedWords.join(' ');
}

export class TopicMessage extends cdk.Stack {
    public subscribersParents: QueueMessage[];
    public topic: cdk.aws_sns.Topic;

    constructor(scope: Construct, id: string, props: TopicProps) {
        super(scope, id, props);
        
        this.topic = new cdk.aws_sns.Topic(this, "idNewTopic", {
            topicName: props.name,
            displayName: prettifyDisplayName(props.name), 
            fifo: props.fifo,
            // enforceSSL: true,
        });
        
        if (props.subscribers && props.subscribersParents) {

            this.subscribersParents = props?.subscribersParents;

            props.subscribers.forEach((subscriber, index) => {
                this.topic.addSubscription(new cdk.aws_sns_subscriptions.SqsSubscription(subscriber, {
                    filterPolicy: {
                        channel: cdk.aws_sns.SubscriptionFilter.stringFilter({
                            allowlist: [this.subscribersParents[index].nickname],
                        })
                    }
                }));
            })
        }
    }
}

export class QueueMessage extends cdk.Stack {
    public readonly queue: cdk.aws_sqs.Queue;
    public readonly nickname: string;
    public readonly correspondFunc: cdk.aws_lambda.Function;

    constructor(scope: Construct, id: string, props: QueueProps) {
        super(scope, id, props);

        this.nickname = props.nickname;
        this.correspondFunc = props.correspondFunc;

        this.queue = new cdk.aws_sqs.Queue(this, "idNewQueue", {
            queueName: props.name,
            fifo: true,
            // enforceSSL: true,
        })

        // Give queue permissions to LambdaQueueToTable.
        this.queue.grantConsumeMessages(this.correspondFunc);
    }
}