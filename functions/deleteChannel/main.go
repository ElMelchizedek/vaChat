// TO DO: Delete subscriptions relating to resources made by the channel's creation.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// Automates frequent error handling.
func errorHandle(message string, err error, format bool) (events.APIGatewayProxyResponse, error) {
	if err != nil {
		if format {
			fmt.Printf("%v %v", events.APIGatewayCustomAuthorizerResponse{}, fmt.Errorf(message, ": %v", err))
			os.Exit(1)
		} else {
			fmt.Printf("ERROR: %v\n", message)
			fmt.Printf("%v\n", events.APIGatewayCustomAuthorizerResponse{})
			os.Exit(1)
		}
	} else {
		fmt.Println("Inccorect use of errorHandle.")
		return events.APIGatewayProxyResponse{}, nil
	}
	fmt.Println("Unknown error regarding errorHandle()")
	return events.APIGatewayProxyResponse{}, nil
}

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

	// TABLE
	// Delete channel's table.
	var deleteTableInput *dynamodb.DeleteTableInput = &dynamodb.DeleteTableInput{
		TableName: aws.String(choiceName + "Table"),
	}
	_, err = dynamoClient.DeleteTable(ctx, deleteTableInput)
	errorHandle("failed to delete channel's dynamod table", err, true)

	// QUEUE
	// Get the URL of the channel's SQS queue.
	var getQueueURLInput *sqs.GetQueueUrlInput = &sqs.GetQueueUrlInput{
		QueueName: aws.String(choiceName + "ChannelQueue"),
	}
	getQueueURLResult, err := sqsClient.GetQueueUrl(ctx, getQueueURLInput)
	errorHandle("failed to get the URL of the channel's queue", err, true)

	// Delete channel's SQS queue.
	var deleteQueueInput *sqs.DeleteQueueInput = &sqs.DeleteQueueInput{
		QueueUrl: getQueueURLResult.QueueUrl,
	}
	_, err = sqsClient.DeleteQueue(ctx, deleteQueueInput)
	errorHandle("failed to delete channel's sqs queue", err, true)

	// TOPIC
	// List all the SNS topics, then get the ARN of the channel's endpoint topic.
	var getTopicARNInput *sns.ListTopicsInput = &sns.ListTopicsInput{}
	getTopicARNResult, err := snsClient.ListTopics(ctx, getTopicARNInput)
	errorHandle("failed to list all topics which is required to get the ARN of the channel's endpoint topic", err, true)

	var topicARN string
	for _, topic := range getTopicARNResult.Topics {
		if strings.Contains(*topic.TopicArn, choiceName) {
			topicARN = *topic.TopicArn
		}
	}
	if topicARN == "" {
		errorHandle("failed to find the ARN of channel's endpoint topic", nil, false)
	}

	// Delete channel's SNS endpoint topic.
	var deleteTopicInput *sns.DeleteTopicInput = &sns.DeleteTopicInput{
		TopicArn: aws.String(topicARN),
	}
	_, err = snsClient.DeleteTopic(ctx, deleteTopicInput)
	errorHandle("failed to delete channel's endpoint topic", err, true)

	// METACHANNEL TABLE
	// Remove the channel's entry in MetaChannelTable
	var deleteMetaChannelTableEntryInput *dynamodb.DeleteItemInput = &dynamodb.DeleteItemInput{
		TableName: aws.String("MetaChannelTable"),
		Key: map[string]types.AttributeValue{
			"Name": &types.AttributeValueMemberS{
				Value: choiceName,
			},
		},
	}
	_, err = dynamoClient.DeleteItem(ctx, deleteMetaChannelTableEntryInput)
	errorHandle("failed to remove channe's entry from MetaChannelTable", err, true)

	// ENDING
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleDeleteChannelRequest)
}
