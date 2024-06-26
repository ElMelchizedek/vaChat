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

		// Channels
		const topicSubscribers: cdk.aws_sqs.IQueue[] = [];
		const topicSubcribersParents: customStack.QueueMessage[] = [];
		const queueNames: string[] = ["alpha", "bravo", "charlie"];
		const queueType: string = "Channel";

		queueNames.forEach(chosenName => {
			const queueMessage = new customStack.QueueMessage(this, ("id".concat(chosenName)), {
				type: queueType,
				name: "".concat(chosenName.toLowerCase(), queueType, "Queue.fifo"),
				nickname: chosenName,
			});

			topicSubscribers.push(queueMessage.queue);
			topicSubcribersParents.push(queueMessage);
		});

		const metaTopic = new customStack.TopicMessage(this, "StackMetaTopic", {
			name: "metaTopic",
			subscribers: topicSubscribers,
			subscribersParents: topicSubcribersParents,
		});
	}
}

const app = new cdk.App();
new Set(app, "dev");