package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	invokedLambda "github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	dynamodbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	lambda "github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	sqsTypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// Automates frequent error handling.
func errorHandle(message string, err error, format bool) (events.APIGatewayProxyResponse, error) {
	if format && err != nil {
		fmt.Printf("%v %v", events.APIGatewayCustomAuthorizerResponse{}, fmt.Errorf(message, ": %v", err))
		os.Exit(1)
	} else if !format {
		fmt.Printf("ERROR: %v\n", message)
		fmt.Printf("%v\n", events.APIGatewayCustomAuthorizerResponse{})
		os.Exit(1)
	} else {
		return events.APIGatewayProxyResponse{}, nil
	}
	fmt.Println("Unknown error regarding errorHandle()")
	return events.APIGatewayProxyResponse{}, nil
}

// Converts map[string]interface variables into json.Marshal-ed strings.
func cleanSelfMadeJson(rawValue map[string]interface{}) string {
	cleanValue, err := json.Marshal(rawValue)
	errorHandle("Failed to json marshal a value", err, true)
	return string(cleanValue)
}

// Main handler function.
func handleCreateChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
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
	var ssmClient *ssm.Client = ssm.NewFromConfig(cfg)
	var lambdaClient *lambda.Client = lambda.NewFromConfig(cfg)

	// TABLE
	// Create new channel's table.
	var createTableInput *dynamodb.CreateTableInput = &dynamodb.CreateTableInput{
		TableName: aws.String(choiceName + "Table"),
		AttributeDefinitions: []dynamodbTypes.AttributeDefinition{
			// TODO: Add IDs as primary key instead of names.
			{
				AttributeName: aws.String("account"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("timestamp"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("content"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeS,
			},
		},
		KeySchema: []dynamodbTypes.KeySchemaElement{
			{
				AttributeName: aws.String("account"),
				KeyType:       dynamodbTypes.KeyTypeHash,
			},
			{
				AttributeName: aws.String("timestamp"),
				KeyType:       dynamodbTypes.KeyTypeRange,
			},
		},
		GlobalSecondaryIndexes: []dynamodbTypes.GlobalSecondaryIndex{
			{
				IndexName: aws.String("AccountContent"),
				KeySchema: []dynamodbTypes.KeySchemaElement{
					{
						AttributeName: aws.String("account"),
						KeyType:       dynamodbTypes.KeyTypeHash,
					},
					{
						AttributeName: aws.String("content"),
						KeyType:       dynamodbTypes.KeyTypeRange,
					},
				},
				Projection: &dynamodbTypes.Projection{
					ProjectionType: dynamodbTypes.ProjectionTypeAll,
				},
			},
		},
		BillingMode: dynamodbTypes.BillingModePayPerRequest,
		StreamSpecification: &dynamodbTypes.StreamSpecification{
			StreamEnabled:  aws.Bool(true),
			StreamViewType: dynamodbTypes.StreamViewTypeNewAndOldImages,
		},
	}
	createTableResult, err := dynamoClient.CreateTable(ctx, createTableInput)
	errorHandle("failed to create new channel's table", err, true)

	// QUEUE
	// Gives SNS permission to send messages to the new channel's queue.
	policyMetaTopicSendMessageQueue := map[string]interface{}{
		"Version": "2012-10-17",
		"Statement": []interface{}{
			map[string]interface{}{
				"Effect":   "Allow",
				"Action":   "sqs:SendMessage",
				"Resource": "*",
				"Principal": map[string]interface{}{
					"Service": []string{
						"sns.amazonaws.com",
					},
				},
			},
		},
	}

	// Create SQS queue for new channel.
	var createQueueInput *sqs.CreateQueueInput = &sqs.CreateQueueInput{
		QueueName: aws.String(choiceName + "Channel" + "Queue"),
		Attributes: map[string]string{
			"Policy": cleanSelfMadeJson(policyMetaTopicSendMessageQueue),
		},
	}
	createQueueResult, err := sqsClient.CreateQueue(ctx, createQueueInput)
	errorHandle("failed to create queue for new channel", err, true)

	// Get new queue's ARN
	var getQueueARNInput *sqs.GetQueueAttributesInput = &sqs.GetQueueAttributesInput{
		QueueUrl: createQueueResult.QueueUrl,
		AttributeNames: []sqsTypes.QueueAttributeName{
			"QueueArn",
		},
	}
	getQueueARNResult, err := sqsClient.GetQueueAttributes(ctx, getQueueARNInput)
	errorHandle("failed to get new channel's queue's ARN", err, true)

	// TOPICS
	// Get MetaTopic's ARN
	var listTopicsInput *sns.ListTopicsInput = &sns.ListTopicsInput{}
	listTopicsResult, err := snsClient.ListTopics(ctx, listTopicsInput)
	errorHandle("faield to list sns topics", err, true)

	var metaTopicARN string
	for _, topic := range listTopicsResult.Topics {
		if strings.Contains(*topic.TopicArn, "metaTopic") {
			metaTopicARN = *topic.TopicArn
			break
		}
	}
	if metaTopicARN == "" {
		errorHandle("failed to find metaTopic's ARN", nil, false)
	}

	// Filter policy for subscription from queue to MetaTopic so as to only allow messages that specify the new channel.
	rawNewFilter := map[string]interface{}{
		"channel": []string{choiceName},
	}

	// Subscribes the newly created queue to MetaTopic
	var subscribeQueueInput *sns.SubscribeInput = &sns.SubscribeInput{
		Endpoint: aws.String(getQueueARNResult.Attributes["QueueArn"]),
		TopicArn: aws.String(metaTopicARN),
		Protocol: aws.String("sqs"),
		Attributes: map[string]string{
			"FilterPolicy": cleanSelfMadeJson(rawNewFilter),
		},
	}
	subscribeQueueResponse, err := snsClient.Subscribe(ctx, subscribeQueueInput)
	errorHandle("failed to subscribe new channel's queue to metaTopic", err, true)

	// Create new channel's endpoint SNS topic.
	var createEndpointTopicInput *sns.CreateTopicInput = &sns.CreateTopicInput{
		Name: aws.String(choiceName + "EndpointTopic"),
	}
	createEndpointTopicResult, err := snsClient.CreateTopic(ctx, createEndpointTopicInput)
	errorHandle("failed to create new channel's endpoint topic", err, true)

	// PARAMETERS
	// Get the lambda handleMessageQueue's ARN so that permissions can be given to it.
	var getParameterHandleMessageQueueARNInput *ssm.GetParameterInput = &ssm.GetParameterInput{
		Name: aws.String("handleMessageQueueARN"),
	}
	getParameterHandleMessageQueueARNResult, err := ssmClient.GetParameter(ctx, getParameterHandleMessageQueueARNInput)
	errorHandle("failed to get the lambda messageHandleQueue's ARN from parameter", err, true)

	// LAMBDA
	// Make the newly created channel's queue an event source for the lambda handleMessageQueue.
	var addEventSourceQueueInput *lambda.CreateEventSourceMappingInput = &lambda.CreateEventSourceMappingInput{
		EventSourceArn: aws.String(getQueueARNResult.Attributes["QueueArn"]),
		FunctionName:   getParameterHandleMessageQueueARNResult.Parameter.Value,
	}
	_, err = lambdaClient.CreateEventSourceMapping(ctx, addEventSourceQueueInput)
	errorHandle("failed to add new channel's queue as an aevent source to the lambda handleMessageQueue", err, true)

	// ENDING
	// Get number of entries in MetaChannelTable to figure out the number to set as the new channel's ID (n+1).
	var getEntriesNumberMetaChannelTableInput *dynamodb.DescribeTableInput = &dynamodb.DescribeTableInput{
		TableName: aws.String("MetaChannelTable"),
	}
	getEntriesNumberMetaChannelTableResult, err := dynamoClient.DescribeTable(ctx, getEntriesNumberMetaChannelTableInput)
	errorHandle("failed to get number of entries in MetaChannelTable", err, true)
	entriesNumberMetaChannelTable := *getEntriesNumberMetaChannelTableResult.Table.ItemCount
	if entriesNumberMetaChannelTable == 0 {
		entriesNumberMetaChannelTable = 1
	}

	// Add channel's complete info for all service into the meta channel info table.
	var putItemChannelInfoInput *dynamodb.PutItemInput = &dynamodb.PutItemInput{
		TableName: aws.String("MetaChannelTable"),
		Item: map[string]dynamodbTypes.AttributeValue{
			"ID": &dynamodbTypes.AttributeValueMemberN{
				Value: strconv.FormatInt(entriesNumberMetaChannelTable, 10),
			},
			"Alias": &dynamodbTypes.AttributeValueMemberS{
				Value: choiceName,
			},
			"TableARN": &dynamodbTypes.AttributeValueMemberS{
				Value: *createTableResult.TableDescription.TableArn,
			},
			"QueueARN": &dynamodbTypes.AttributeValueMemberS{
				Value: getQueueARNResult.Attributes["QueueArn"],
			},
			"EndpointTopicARN": &dynamodbTypes.AttributeValueMemberS{
				Value: *createEndpointTopicResult.TopicArn,
			},
			"SubscriptionARN": &dynamodbTypes.AttributeValueMemberS{
				Value: *subscribeQueueResponse.SubscriptionArn,
			},
		},
	}

	// Send a JSON body for the return response from API Gateway to the client webserver with any potentially desired information about the newly created channel.
	rawReturnBody := map[string]interface{}{
		"ID":               entriesNumberMetaChannelTable,
		"Alias":            choiceName,
		"TableARN":         createTableResult.TableDescription.TableArn,
		"QueueARN":         getQueueARNResult.Attributes["QueueArn"],
		"EndpointTopicARN": createEndpointTopicResult.TopicArn,
		"SubscriptionARN":  subscribeQueueResponse.SubscriptionArn,
	}
	_, err = dynamoClient.PutItem(ctx, putItemChannelInfoInput)
	errorHandle("failed to put new channel's complete info into meta info table", err, true)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       cleanSelfMadeJson(rawReturnBody),
	}, nil
}

func main() {
	invokedLambda.Start(handleCreateChannelRequest)
}
