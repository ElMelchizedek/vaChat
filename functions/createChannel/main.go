package main

import (
	"context"
	"encoding/json"
	"fmt"
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

// *** UTILITY FUNCTIONS *** //
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

// Converts map[string]interface variables into json.Marshal-ed strings.
func cleanSelfMadeJson(rawValue map[string]interface{}) string {
	cleanValue, err := json.Marshal(rawValue)
	errorHandle("Failed to json marshal a value", err, true)
	return string(cleanValue)
}

// *** ASYNC SERVICE FUNCTIONS *** //
// Creates DynamoDB table to contain messages of new channel.
func createTable(name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan *dynamodb.CreateTableOutput) {
	createTableInput := dynamodb.CreateTableInput{
		TableName: aws.String(name + "Table"),
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

	createTableResult, err := dynamoClient.CreateTable(*ctx, &createTableInput)
	errorHandle("failed to create new channel's table", err, true)
	result <- createTableResult
}

// Creates SQS queue for new channel.
func createQueue(name string, ctx *context.Context, sqsClient *sqs.Client, result chan *sqs.CreateQueueOutput) {
	// Gives SNS permission to send messages to the new channel's queue.
	policy := map[string]interface{}{
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

	createQueueInput := sqs.CreateQueueInput{
		QueueName: aws.String(name + "Channel" + "Queue"),
		Attributes: map[string]string{
			"Policy": cleanSelfMadeJson(policy),
		},
	}

	createQueueResult, err := sqsClient.CreateQueue(*ctx, &createQueueInput)
	errorHandle("failed to create queue for new channel", err, true)
	result <- createQueueResult
}

func getQueueARN(queueURL *string, ctx *context.Context, sqsClient *sqs.Client, result chan *sqs.GetQueueAttributesOutput) {
	getQueueARNInput := sqs.GetQueueAttributesInput{
		QueueUrl: queueURL,
		AttributeNames: []sqsTypes.QueueAttributeName{
			"QueueArn",
		},
	}

	getQueueARNResult, err := sqsClient.GetQueueAttributes(*ctx, &getQueueARNInput)
	errorHandle("failed to get new channel's queue's ARN", err, true)
	result <- getQueueARNResult
}

func getMetaTopicARN(ctx *context.Context, snsClient *sns.Client, result chan string) {
	listTopicsInput := sns.ListTopicsInput{}

	listTopicsResult, err := snsClient.ListTopics(*ctx, &listTopicsInput)
	errorHandle("failed to list sns topics", err, true)

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

	result <- metaTopicARN
}

func subscribeQueue(name string, queueARN string, metaTopicARN string, ctx *context.Context, snsClient *sns.Client, result chan *sns.SubscribeOutput) {
	// Filter policy for subscription from queue to MetaTopic so as to only allow messages that specify the new channel.
	filter := map[string]interface{}{
		"channel": []string{name},
	}

	fmt.Printf("Name:%v\n", name)
	fmt.Printf("Endpoint:%v\n", queueARN)
	fmt.Printf("TopicArn:%v\n", metaTopicARN)

	subscribeQueueInput := sns.SubscribeInput{
		Endpoint: aws.String(queueARN),
		TopicArn: aws.String(metaTopicARN),
		Protocol: aws.String("sqs"),
		Attributes: map[string]string{
			"FilterPolicy": cleanSelfMadeJson(filter),
		},
	}

	subscribeQueueResult, err := snsClient.Subscribe(*ctx, &subscribeQueueInput)
	errorHandle("failed to subscribe new channel's queue to metaTopic", err, true)
	result <- subscribeQueueResult
}

func getHandleMessageQueueARN(ctx *context.Context, ssmClient *ssm.Client, result chan *ssm.GetParameterOutput) {
	getHandleMessageQueueARNInput := ssm.GetParameterInput{
		Name: aws.String("handleMessageQueueARN"),
	}

	getHandleMessageQueueARNResult, err := ssmClient.GetParameter(*ctx, &getHandleMessageQueueARNInput)
	errorHandle("failed to get the lambda messageHandleQueue's ARN from parameter", err, true)
	result <- getHandleMessageQueueARNResult
}

func createTopic(name string, ctx *context.Context, snsClient *sns.Client, result chan *sns.CreateTopicOutput) {
	createTopicInput := sns.CreateTopicInput{
		Name: aws.String(name + "EndpointTopic"),
	}

	createTopicResult, err := snsClient.CreateTopic(*ctx, &createTopicInput)
	errorHandle("failed to create new channel's topic", err, true)
	result <- createTopicResult
}

func addEventSourceQueue(queueARN string, lambdaARN string, ctx *context.Context, lambdaClient *lambda.Client, result chan *lambda.CreateEventSourceMappingOutput) {
	addEventSourceQueueInput := lambda.CreateEventSourceMappingInput{
		// EventSourceArn: aws.String(getQueueARNResult.Attributes["QueueArn"]),
		// FunctionName:   getHandleMessageQueueARNResult.Parameter.Value,
		EventSourceArn: aws.String(queueARN),
		FunctionName:   aws.String(lambdaARN),
	}

	addEventSourceQueueResult, err := lambdaClient.CreateEventSourceMapping(*ctx, &addEventSourceQueueInput)
	errorHandle("failed to add new channel's queue as an aevent source to the lambda handleMessageQueue", err, true)
	result <- addEventSourceQueueResult
}

func getEntriesNumberMetaChannelTable(ctx *context.Context, dynamoClient *dynamodb.Client, result chan int) {
	getEntriesNumberMetaChannelTableInput := dynamodb.DescribeTableInput{
		TableName: aws.String("MetaChannelTable"),
	}
	getEntriesNumberMetaChannelTableInputResult, err := dynamoClient.DescribeTable(*ctx, &getEntriesNumberMetaChannelTableInput)
	errorHandle("failed to get number of entries in MetaChannelTable", err, true)

	entriesNumberMetaChannelTable := *getEntriesNumberMetaChannelTableInputResult.Table.ItemCount
	if entriesNumberMetaChannelTable == 0 {
		entriesNumberMetaChannelTable = 1
	}

	result <- int(entriesNumberMetaChannelTable)
}

func addEntryMetaChannelTable(entriesMetaChannelTable int, name string, tableARN string, queueARN string, topicARN string, subscriptionARN string, ctx *context.Context,
	dynamoClient *dynamodb.Client, result chan *dynamodb.PutItemOutput) {
	addEntryMetaChannelTableInput := dynamodb.PutItemInput{
		TableName: aws.String("MetaChannelTable"),
		Item: map[string]dynamodbTypes.AttributeValue{
			"ID": &dynamodbTypes.AttributeValueMemberN{
				Value: strconv.Itoa(entriesMetaChannelTable),
			},
			"Alias": &dynamodbTypes.AttributeValueMemberS{
				Value: name,
			},
			"TableARN": &dynamodbTypes.AttributeValueMemberS{
				Value: tableARN,
			},
			"QueueARN": &dynamodbTypes.AttributeValueMemberS{
				Value: queueARN,
			},
			"EndpointTopicARN": &dynamodbTypes.AttributeValueMemberS{
				Value: topicARN,
			},
			"SubscriptionARN": &dynamodbTypes.AttributeValueMemberS{
				Value: subscriptionARN,
			},
		},
	}

	addEntryMetaChannelTableResult, err := dynamoClient.PutItem(*ctx, &addEntryMetaChannelTableInput)
	errorHandle("failed to put new channel's complete info into MetaChannelTable", err, true)
	result <- addEntryMetaChannelTableResult
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
	createTableChannel := make(chan *dynamodb.CreateTableOutput)
	go createTable(choiceName, &ctx, dynamoClient, createTableChannel)
	createTableResult := <-createTableChannel

	// QUEUE
	// Create SQS queue for new channel.
	createQueueChannel := make(chan *sqs.CreateQueueOutput)
	go createQueue(choiceName, &ctx, sqsClient, createQueueChannel)
	createQueueResult := <-createQueueChannel

	// Get new queue's ARN
	getQueueARNChannel := make(chan *sqs.GetQueueAttributesOutput)
	go getQueueARN(createQueueResult.QueueUrl, &ctx, sqsClient, getQueueARNChannel)
	getQueueARNResult := <-getQueueARNChannel
	fmt.Printf("GetQueueARN Attributes:%v", getQueueARNResult.Attributes)

	// TOPICS
	// Get MetaTopic's ARN
	getMetaTopicARNChannel := make(chan string)
	go getMetaTopicARN(&ctx, snsClient, getMetaTopicARNChannel)
	metaTopicARN := <-getMetaTopicARNChannel

	// Subscribes the newly created queue to MetaTopic
	subscribeQueueChannel := make(chan *sns.SubscribeOutput)
	go subscribeQueue(choiceName, getQueueARNResult.Attributes["QueueArn"], metaTopicARN, &ctx, snsClient, subscribeQueueChannel)
	subscribeQueueResult := <-subscribeQueueChannel

	// Create new channel's endpoint SNS topic.
	createTopicChannel := make(chan *sns.CreateTopicOutput)
	go createTopic(choiceName, &ctx, snsClient, createTopicChannel)
	createTopicResult := <-createTopicChannel

	// PARAMETERS
	// Get the lambda handleMessageQueue's ARN so that permissions can be given to it.
	getHandleMessageQueueARNChannel := make(chan *ssm.GetParameterOutput)
	go getHandleMessageQueueARN(&ctx, ssmClient, getHandleMessageQueueARNChannel)
	getHandleMessageQueueARNResult := <-getHandleMessageQueueARNChannel

	// LAMBDA
	// Make the newly created channel's queue an event source for the lambda handleMessageQueue.
	addEventSourceQueueChannel := make(chan *lambda.CreateEventSourceMappingOutput)
	go addEventSourceQueue(getQueueARNResult.Attributes["QueueArn"], *getHandleMessageQueueARNResult.Parameter.Value, &ctx, lambdaClient, addEventSourceQueueChannel)
	<-addEventSourceQueueChannel

	// ENDING
	// Get number of entries in MetaChannelTable to figure out the number to set as the new channel's ID (n+1).
	getEntriesNumberMetaChannelTableChannel := make(chan int)
	go getEntriesNumberMetaChannelTable(&ctx, dynamoClient, getEntriesNumberMetaChannelTableChannel)
	entriesNumberMetaChannelTable := <-getEntriesNumberMetaChannelTableChannel

	// Add channel's complete info for all service into the meta channel info table.
	addEntryMetaChannelTableChannel := make(chan *dynamodb.PutItemOutput)
	go addEntryMetaChannelTable(
		entriesNumberMetaChannelTable,
		choiceName,
		*createTableResult.TableDescription.TableArn,
		getQueueARNResult.Attributes["QueueArn"],
		*createTopicResult.TopicArn,
		*subscribeQueueResult.SubscriptionArn,
		&ctx,
		dynamoClient,
		addEntryMetaChannelTableChannel,
	)
	<-addEntryMetaChannelTableChannel

	// Send a JSON body for the return response from API Gateway to the client webserver with any potentially desired information about the newly created channel.
	rawReturnBody := map[string]interface{}{
		"ID":               entriesNumberMetaChannelTable,
		"Alias":            choiceName,
		"TableARN":         createTableResult.TableDescription.TableArn,
		"QueueARN":         getQueueARNResult.Attributes["QueueArn"],
		"EndpointTopicARN": createTopicResult.TopicArn,
		"SubscriptionARN":  subscribeQueueResult.SubscriptionArn,
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       cleanSelfMadeJson(rawReturnBody),
	}, nil
}

func main() {
	invokedLambda.Start(handleCreateChannelRequest)
}
