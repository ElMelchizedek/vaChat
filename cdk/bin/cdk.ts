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

		// Service-agnostic channel variables
		const channelNames: string[] = ["alpha", "bravo", "charlie"];

		// Channel queues and tables
		const topicSubscribers: cdk.aws_sqs.IQueue[] = [];
		const topicSubcribersParents: customStack.QueueMessage[] = [];
		const queueType: string = "Channel";

		// Pre-emptively define lambda that moves channel messages into tables so as to allow it access to said queues and tables.
		const functionQueueToTable = new customStack.CustomLambda(this, "IdLambdaQueueToTable", {
			name: "QueueToTable",
		});

		channelNames.forEach(chosenName => {
			// Create SQS queues
			const queueChannel = new customStack.QueueMessage(this, ("IdQueue".concat(chosenName)), {
				type: queueType,
				name: "".concat(chosenName.toLowerCase(), queueType, "Queue.fifo"),
				nickname: chosenName,
			});
			// Give queue permissions to lambda mentioned previously.
			queueChannel.queue.grantConsumeMessages(functionQueueToTable.func);
			// Assign it to the topic subscribers array.
			topicSubscribers.push(queueChannel.queue);
			topicSubcribersParents.push(queueChannel);

			// Create DynamoDB tables
			const tableChannel = new customStack.TableChannel(this, ("IdTable".concat(chosenName)), {
				channelName: chosenName,
			});
			// Give table permissions to lambda.
			tableChannel.table.grantFullAccess(functionQueueToTable.func);
		});

		// SNS topic which will filter to messages to correct queue for backend pipeline.
		const metaTopic = new customStack.TopicMessage(this, "StackMetaTopic", {
			name: "metaTopic",
			subscribers: topicSubscribers,
			subscribersParents: topicSubcribersParents,
			fifo: true,
		});

		// Set event sources for lambda to the message queues, so that it is properly invoked when messages are sent by users.
		functionQueueToTable.func.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(topicSubscribers[0]));

		// Per-channel SNS topic to be subscribed to by listening client servers.
		channelNames.forEach(chosenName => {
			const topicChannel = new customStack.TopicMessage(this, ("IdTopic".concat(chosenName)), {
				name: "channelTopic".concat(chosenName),
				fifo: false
			});

			console.log(process.env.IP);
			if (process.env.IP) {
				topicChannel.topic.addSubscription(new cdk.aws_sns_subscriptions.UrlSubscription("http://".concat(process.env.IP, ":3000/sns")));
			}
		})
	}
}

const app = new cdk.App();
new Set(app, "dev");