// TO DO: Delete subscriptions relating to resources made by the channel's creation.
// TO DO: Make common function for both getChannelID() and getSubscriptionARN().
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	lambdaService "github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// Automates frequent error handling.
func errorHandle(message string, err error, format bool) (events.APIGatewayProxyResponse, error) {
	if format && err != nil {
		fmt.Printf("%v %v", events.APIGatewayCustomAuthorizerResponse{}, fmt.Errorf(message, ": %v", err))
		return events.APIGatewayProxyResponse{}, nil
		// os.Exit(1)
	} else if !format {
		fmt.Printf("ERROR: %v\n", message)
		fmt.Printf("%v\n", events.APIGatewayCustomAuthorizerResponse{})
		return events.APIGatewayProxyResponse{}, nil
		// os.Exit(1)
	} else {
		return events.APIGatewayProxyResponse{}, nil
	}
	fmt.Println("Unknown error regarding errorHandle()")
	return events.APIGatewayProxyResponse{}, nil
}

func deleteTable(name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan *dynamodb.DeleteTableOutput) {
	deleteTableInput := dynamodb.DeleteTableInput{
		TableName: aws.String(name + "Table"),
	}
	deleteTableResult, err := dynamoClient.DeleteTable(*ctx, &deleteTableInput)
	errorHandle("failed to delete channel's dynamod table", err, true)
	result <- deleteTableResult
}

func getQueueURL(name string, ctx *context.Context, sqsClient *sqs.Client, result chan *sqs.GetQueueUrlOutput) {
	getQueueURLInput := sqs.GetQueueUrlInput{
		QueueName: aws.String(name + "ChannelQueue"),
	}
	getQueueURLResult, err := sqsClient.GetQueueUrl(*ctx, &getQueueURLInput)
	errorHandle("failed to get the URL of the channel's queue", err, true)
	result <- getQueueURLResult
}

func deleteQueue(queueURL string, ctx *context.Context, sqsClient *sqs.Client, result chan *sqs.DeleteQueueOutput) {
	deleteQueueInput := sqs.DeleteQueueInput{
		QueueUrl: aws.String(queueURL),
	}
	deleteQueueResult, err := sqsClient.DeleteQueue(*ctx, &deleteQueueInput)
	errorHandle("failed to delete channel's sqs queue", err, true)
	result <- deleteQueueResult
}

func getTopicARN(name string, ctx *context.Context, snsClient *sns.Client, result chan string) {
	listTopicsInput := sns.ListTopicsInput{}

	listTopicsResult, err := snsClient.ListTopics(*ctx, &listTopicsInput)
	errorHandle("failed to list all topics which is required to get the ARN of the channel's topic", err, true)

	var topicARN string
	for _, topic := range listTopicsResult.Topics {
		if strings.Contains(*topic.TopicArn, name) {
			topicARN = *topic.TopicArn
			break
		}
	}
	if topicARN == "" {
		errorHandle("failed to find topic's ARN", nil, false)
	}

	result <- topicARN
}

func deleteTopic(topicARN string, ctx *context.Context, snsClient *sns.Client, result chan *sns.DeleteTopicOutput) {
	deleteTopicInput := sns.DeleteTopicInput{
		TopicArn: aws.String(topicARN),
	}
	deleteTopicResult, err := snsClient.DeleteTopic(*ctx, &deleteTopicInput)
	errorHandle("failed to delete channel's topic", err, true)
	result <- deleteTopicResult
}

func getChannelID(name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan string) {
	getChannelIDInput := dynamodb.ScanInput{
		TableName:        aws.String("MetaChannelTable"),
		FilterExpression: aws.String(fmt.Sprintf("%s = :v", "Alias")),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":v": &types.AttributeValueMemberS{
				Value: name,
			},
		},
	}

	getChannelIDResult, err := dynamoClient.Scan(*ctx, &getChannelIDInput)
	errorHandle("failed to scan MetaChannelTable to find ID of channel", err, true)

	if len(getChannelIDResult.Items) == 0 {
		errorHandle("no results from scanning of ID for specified channel", nil, false)
	}

	var channelID string
	for _, item := range getChannelIDResult.Items {
		channelID = item["ID"].(*types.AttributeValueMemberN).Value
	}
	if channelID == "" {
		errorHandle("could not find ID for specified channel", nil, false)
	}

	result <- channelID
}

func removeEntryMetaChannelTable(id string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan *dynamodb.DeleteItemOutput) {
	removeEntryMetaChannelTableInput := dynamodb.DeleteItemInput{
		TableName: aws.String("MetaChannelTable"),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberN{
				Value: id,
			},
		},
	}

	removeEntryMetaChannelTableResult, err := dynamoClient.DeleteItem(*ctx, &removeEntryMetaChannelTableInput)
	errorHandle("failed to remove channel's entry from MetaChannelTable", err, true)

	result <- removeEntryMetaChannelTableResult
}

func getHandleMessageQueueARN(ctx *context.Context, ssmClient *ssm.Client, result chan *ssm.GetParameterOutput) {
	getHandleMessageQueueARNInput := ssm.GetParameterInput{
		Name: aws.String("handleMessageQueueARN"),
	}

	getHandleMessageQueueARNResult, err := ssmClient.GetParameter(*ctx, &getHandleMessageQueueARNInput)
	errorHandle("failed to get the lambda messageHandleQueue's ARN from parameter", err, true)
	result <- getHandleMessageQueueARNResult
}

func getEventSourceMapping(name string, lambda string, ctx *context.Context, lambdaClient *lambdaService.Client, result chan string) {
	getEventSourceMappingInput := lambdaService.ListEventSourceMappingsInput{
		FunctionName: aws.String(lambda),
	}

	getEventSourceMappingResult, err := lambdaClient.ListEventSourceMappings(*ctx, &getEventSourceMappingInput)
	errorHandle("failed to get list of event source mappings that map to the handleMessageQueue lambda.", err, true)

	var eventSourceMappingUUID string
	for _, mapping := range getEventSourceMappingResult.EventSourceMappings {
		if strings.Contains(*mapping.EventSourceArn, name) {
			eventSourceMappingUUID = *mapping.UUID
		}
	}
	if eventSourceMappingUUID == "" {
		errorHandle("failed to get UUID for event source mapping between handleMessageQueue lambda and the now non-existent SQS queue", nil, false)
	}

	result <- eventSourceMappingUUID
}

func deleteEventSourceMapping(uuid string, ctx *context.Context, lambdaClient *lambdaService.Client, result chan *lambdaService.DeleteEventSourceMappingOutput) {
	deleteEventSourceMappingInput := lambdaService.DeleteEventSourceMappingInput{
		UUID: aws.String(uuid),
	}

	deleteEventSourceMappingResult, err := lambdaClient.DeleteEventSourceMapping(*ctx, &deleteEventSourceMappingInput)
	errorHandle("failed to delete event source mapping betwen handleMessageQueue lambda and the now non-existent SQS queue", err, true)

	result <- deleteEventSourceMappingResult
}

// func getSubscriptionARN(name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan string) {
// 	getSubscriptionARNInput := dynamodb.ScanInput{
// 		TableName:        aws.String("MetaChannelTable"),
// 		FilterExpression: aws.String(fmt.Sprintf("%s = :v", "Alias")),
// 		ExpressionAttributeValues: map[string]types.AttributeValue{
// 			":v": &types.AttributeValueMemberS{
// 				Value: name,
// 			},
// 		},
// 	}

// 	getSubscriptionARNResult, err := dynamoClient.Scan(*ctx, &getSubscriptionARNInput)
// 	errorHandle("failed to scan MetaChannelTable to find subscription ARN of channel", err, true)

// 	if len(getSubscriptionARNResult.Items) == 0 {
// 		errorHandle("no results from scanning of subscription ARN for specified channel", nil, false)
// 	}

// 	var subscriptionARN string
// 	for _, item := range getSubscriptionARNResult.Items {
// 		subscriptionARN = item["SubscriptionARN"].(*types.AttributeValueMemberN).Value
// 	}
// 	if subscriptionARN == "" {
// 		errorHandle("could not find ID for specified channel", nil, false)
// 	}

// 	result <- subscriptionARN
// }

// func deleteSubscription(arn string, ctx *context.Context, snsClient *sns.Client, result chan *sns.UnsubscribeOutput) {
// 	deleteSubscriptionInput := sns.UnsubscribeInput{
// 		SubscriptionArn: aws.String(arn),
// 	}

// 	deleteSubscriptionResult, err := snsClient.Unsubscribe(*ctx, &deleteSubscriptionInput)
// 	errorHandle("failed to delete subscription of channel", err, true)

// 	result <- deleteSubscriptionResult
// }

func handleDeleteChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Parse chosen name from json body request.
	var choiceName string
	var decodedData map[string]interface{}

	err := json.Unmarshal([]byte(request.Body), &decodedData)
	errorHandle("json.Unmarshal error", err, true)

	if value, ok := decodedData["name"]; !ok {
		fmt.Println("No name key in json body.")
		return events.APIGatewayProxyResponse{}, nil
	} else {
		choiceName = value.(string)
	}

	// Set up aws sdk config.
	var cfg aws.Config
	cfg, err = config.LoadDefaultConfig(ctx,
		config.WithRegion("ap-southeast-2"),
	)
	errorHandle("failed to initialise SDK with default configuration", err, true)

	// Initialise clients for services.
	var dynamoClient *dynamodb.Client = dynamodb.NewFromConfig(cfg)
	var sqsClient *sqs.Client = sqs.NewFromConfig(cfg)
	var snsClient *sns.Client = sns.NewFromConfig(cfg)
	var lambdaClient *lambdaService.Client = lambdaService.NewFromConfig(cfg)
	var ssmClient *ssm.Client = ssm.NewFromConfig(cfg)

	// TABLE
	// Delete channel's table.
	deleteTableChannel := make(chan *dynamodb.DeleteTableOutput)
	go deleteTable(choiceName, &ctx, dynamoClient, deleteTableChannel)
	<-deleteTableChannel

	// QUEUE
	// Get the URL of the channel's SQS queue.
	getQueueURLChannel := make(chan *sqs.GetQueueUrlOutput)
	go getQueueURL(choiceName, &ctx, sqsClient, getQueueURLChannel)
	getQueueURLResult := <-getQueueURLChannel

	// Delete channel's SQS queue.
	deleteQueueChannel := make(chan *sqs.DeleteQueueOutput)
	go deleteQueue(*getQueueURLResult.QueueUrl, &ctx, sqsClient, deleteQueueChannel)
	<-deleteQueueChannel

	// TOPIC
	// List all the SNS topics, then get the ARN of the channel's endpoint topic.
	getTopicARNChannel := make(chan string)
	go getTopicARN(choiceName, &ctx, snsClient, getTopicARNChannel)
	topicARN := <-getTopicARNChannel

	// Delete channel's SNS endpoint topic.
	deleteTopicChannel := make(chan *sns.DeleteTopicOutput)
	go deleteTopic(topicARN, &ctx, snsClient, deleteTopicChannel)
	<-deleteTopicChannel

	// METACHANNEL TABLE
	// Get ID of channel.
	getChannelIDChannel := make(chan string)
	go getChannelID(choiceName, &ctx, dynamoClient, getChannelIDChannel)
	channelID := <-getChannelIDChannel

	// Remove the channel's entry in MetaChannelTable
	removeEntryMetaChannelTableChannel := make(chan *dynamodb.DeleteItemOutput)
	go removeEntryMetaChannelTable(channelID, &ctx, dynamoClient, removeEntryMetaChannelTableChannel)
	<-removeEntryMetaChannelTableChannel

	// LAMBDA
	// Get ARN of the handleMessageQueue lambda.
	getHandleMessageQueueARNChannel := make(chan *ssm.GetParameterOutput)
	go getHandleMessageQueueARN(&ctx, ssmClient, getHandleMessageQueueARNChannel)
	getHandleMessageQueueARNResult := <-getHandleMessageQueueARNChannel

	// Get the event source mapping between the handleMessageQueue lambad and the now non-existent SQS queue.
	getEventSourceMappingChannel := make(chan string)
	go getEventSourceMapping(choiceName, *getHandleMessageQueueARNResult.Parameter.Value, &ctx, lambdaClient, getEventSourceMappingChannel)
	eventSourceMappingUUID := <-getEventSourceMappingChannel

	// Delete the event source mapping.
	deleteEventSourceMappingChannel := make(chan *lambdaService.DeleteEventSourceMappingOutput)
	go deleteEventSourceMapping(eventSourceMappingUUID, &ctx, lambdaClient, deleteEventSourceMappingChannel)
	<-deleteEventSourceMappingChannel

	// SUBSCRIPTION
	// Get ARN of channel's queue's subscription to metaTopic.
	// getSubscriptionARNChannel := make(chan string)
	// go getSubscriptionARN(choiceName, &ctx, dynamoClient, getSubscriptionARNChannel)
	// subscriptionARN := <-getSubscriptionARNChannel

	// Delete said subscription.
	// deleteSubscriptionChannel := make(chan *sns.UnsubscribeOutput)
	// go deleteSubscription(subscriptionARN, &ctx, snsClient, deleteSubscriptionChannel)
	// <-deleteSubscriptionChannel

	// ENDING
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleDeleteChannelRequest)
}
