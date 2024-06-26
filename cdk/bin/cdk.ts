#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as customStack from "../lib/stackMain";

interface EnvProps {
	prod: boolean
};

class Set extends Construct {
	constructor(scope: Construct, id: string, props?: EnvProps) {
		super(scope, id);
		// new customStack.MessageTable(this, "StackMsgTable");

		const topicSubscribers: cdk.aws_sqs.IQueue[] = [];
		const topicSubcribersParents: customStack.QueueMessage[] = [];
		const queueNames: string[] = ["anorien", "belfalas", "ithilien"];
		const queueType: string = "Guild";

		queueNames.forEach(chosenName => {
			const queueMessage = new customStack.QueueMessage(this, ("id".concat(chosenName)), {
				type: queueType,
				name: chosenName.concat(queueType, "Queue.fifo"),
				nickname: chosenName,
			});

			topicSubscribers.push(queueMessage.queue);
			topicSubcribersParents.push(queueMessage);
		});

		const newTopic = new customStack.TopicMessage(this, "StackGuildTopic", {
			name: "guildTopic",
			subscribers: topicSubscribers,
			subscribersParents: topicSubcribersParents,
		});
	}
}

const app = new cdk.App();
new Set(app, "dev");