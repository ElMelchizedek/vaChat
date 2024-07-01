package main

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
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

func printStructContents[T any](selectStruct T) {
	t := reflect.TypeOf(selectStruct)
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		value := reflect.ValueOf(selectStruct).Field(i).Interface()
		fmt.Printf("%s: %v\n", field.Name, value)
	}
}

func handleCreateChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	printStructContents(request)

	var choiceName string
	var decodedData map[string]interface{}

	if err := json.Unmarshal([]byte(request.Body), &decodedData); err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("json.Unmarshal error: %v", err)
	}

	if value, ok := decodedData["name"]; !ok {
		fmt.Println("No name key in json body.")
		return events.APIGatewayProxyResponse{}, nil
	} else {
		choiceName = value.(string)
	}

	var cfg aws.Config
	var err error
	cfg, err = config.LoadDefaultConfig(ctx,
		config.WithRegion("ap-southeast-2"),
	)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to initialise SDK with default configuration: %v", err)
	}

	// TABLE
	var dynamoClient *dynamodb.Client = dynamodb.NewFromConfig(cfg)

	// Create new channel's table.
	var createTableInput *dynamodb.CreateTableInput = &dynamodb.CreateTableInput{
		TableName: aws.String(choiceName + "Table"),
		AttributeDefinitions: []dynamodbTypes.AttributeDefinition{
			// TODO: Add IDs as primary key instead of names.
			{
				AttributeName: aws.String("Account"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("Time"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("Content"),
				AttributeType: dynamodbTypes.ScalarAttributeTypeS,
			},
		},
		KeySchema: []dynamodbTypes.KeySchemaElement{
			{
				AttributeName: aws.String("Account"),
				KeyType:       dynamodbTypes.KeyTypeHash,
			},
			{
				AttributeName: aws.String("Time"),
				KeyType:       dynamodbTypes.KeyTypeRange,
			},
		},
		GlobalSecondaryIndexes: []dynamodbTypes.GlobalSecondaryIndex{
			{
				IndexName: aws.String("AccountContent"),
				KeySchema: []dynamodbTypes.KeySchemaElement{
					{
						AttributeName: aws.String("Account"),
						KeyType:       dynamodbTypes.KeyTypeHash,
					},
					{
						AttributeName: aws.String("Content"),
						KeyType:       dynamodbTypes.KeyTypeRange,
					},
				},
				Projection: &dynamodbTypes.Projection{
					NonKeyAttributes: []string{
						"Time",
					},
					ProjectionType: dynamodbTypes.ProjectionTypeAll,
				},
			},
		},
	}

	createTableResult, err := dynamoClient.CreateTable(ctx, createTableInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to create new channel's table: %v", err)
	}
	fmt.Printf("createTableResult\n %v", createTableResult)

	// QUEUE
	var sqsClient *sqs.Client = sqs.NewFromConfig(cfg)

	// Create SQS queue for new channel.
	var createQueueInput *sqs.CreateQueueInput = &sqs.CreateQueueInput{
		QueueName: aws.String(choiceName + "Channel" + "Queue"),
	}

	createQueueResult, err := sqsClient.CreateQueue(ctx, createQueueInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to create queue for new channel: %v", err)
	}
	fmt.Printf("createQueueResult\n %v", createQueueResult)

	// Get new queue's ARN
	var getQueueARNInput *sqs.GetQueueAttributesInput = &sqs.GetQueueAttributesInput{
		AttributeNames: []sqsTypes.QueueAttributeName{
			"QueueArn",
		},
	}

	getQueueARNResult, err := sqsClient.GetQueueAttributes(ctx, getQueueARNInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to get new channe's queue's ARN: %v", err)
	}
	fmt.Printf("getQueueARNResult\n %v", getQueueARNResult)

	// TOPICS
	var snsClient *sns.Client = sns.NewFromConfig(cfg)

	// Get MetaTopic's ARN
	var listTopicsInput *sns.ListTopicsInput = &sns.ListTopicsInput{}

	listTopicsResult, err := snsClient.ListTopics(ctx, listTopicsInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to list sns topics: %v", err)
	}
	fmt.Printf("listTopicsResult\n %v", listTopicsResult)

	var metaTopicARN string
	for _, topic := range listTopicsResult.Topics {
		if strings.Contains(*topic.TopicArn, "metaTopic") {
			metaTopicARN = *topic.TopicArn
			break
		}
	}

	if metaTopicARN == "" {
		fmt.Println("Failed to find metaTopic's ARN.")
		return events.APIGatewayProxyResponse{}, nil
	}

	// Subscribes the newly created queue to MetaTopic
	var subscribeQueueInput *sns.SubscribeInput = &sns.SubscribeInput{
		Endpoint: aws.String(getQueueARNResult.Attributes["QueueArn"]),
		TopicArn: aws.String(metaTopicARN),
		Protocol: aws.String("sqs"),
	}

	subscribeQueueResult, err := snsClient.Subscribe(ctx, subscribeQueueInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to subscribe new channel's queue to metaTopic: %v", err)
	}
	fmt.Printf("subscribeQueueResult\n %v", subscribeQueueResult)

	// Create new channel's endpoint SNS topic.
	var createEndpointTopicInput *sns.CreateTopicInput = &sns.CreateTopicInput{
		Name: aws.String(choiceName + "EndpointTopic"),
	}

	createEndpointTopicResult, err := snsClient.CreateTopic(ctx, createEndpointTopicInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to create new channel's endpoint topic: %v", err)
	}
	fmt.Printf("createEndpointTopicResult\n %v", createEndpointTopicResult)

	// PERMISSIONS
	var ssmClient *ssm.Client = ssm.NewFromConfig(cfg)

	// Get the lambda handleMessageQueue's ARN so that permissions can be given to it.
	var getParameterHandleMessageQueueARNInput *ssm.GetParameterInput = &ssm.GetParameterInput{
		Name: aws.String("handleMessageQueueARN"),
	}

	getParameterHandleMessageQueueARNResult, err := ssmClient.GetParameter(ctx, getParameterHandleMessageQueueARNInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to get the lambda messageHandleQueue's ARN from parameter: %v", err)
	}
	fmt.Printf("getParameterhandleMessageQueueARNResult\n %v", getParameterHandleMessageQueueARNResult)

	// Policy allowing the lambda handleMessageQueue to publish to the soon-to-be endpoint SNS topic of the new channel.
	rawPolicy := map[string]interface{}{
		"Version": "2012-10-17",
		"Statement": []interface{}{
			map[string]interface{}{
				"Effect":   "Allow",
				"Action":   "sns:Publish",
				"Resource": createEndpointTopicResult.TopicArn,
				"Principal": map[string]interface{}{
					"AWS": getParameterHandleMessageQueueARNResult.Parameter.Value,
				},
			},
		},
	}

	cleanPolicy, err := json.Marshal(rawPolicy)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to marshal JSON version of policy statement: %v", err)
	}
	fmt.Printf("cleanPolicy\n %v", cleanPolicy)

	// Give the lambda handleMessageQueue the permissions to publish to the new channel's endpoint topic.
	var setTopicAttributesEndpointTopicInput *sns.SetTopicAttributesInput = &sns.SetTopicAttributesInput{
		TopicArn:       createEndpointTopicResult.TopicArn,
		AttributeName:  aws.String("Policy"),
		AttributeValue: aws.String(string(cleanPolicy)),
	}

	setTopicAttributesEndpointTopicResult, err := snsClient.SetTopicAttributes(ctx, setTopicAttributesEndpointTopicInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to add policy allowing handleMessageQueue to publish to new channe's endpoint topic: %v", err)
	}
	fmt.Printf("setTopicAttributesEndpointTopicResult\n %v", setTopicAttributesEndpointTopicResult)

	// LAMBDA
	var lambdaClient *lambda.Client = lambda.New(lambda.Options{
		Region: "ap-southeast-2",
	})
	// Make the newly created channel's queue an event source for the lambda handleMessageQueue.
	var addEventSourceQueueInput *lambda.CreateEventSourceMappingInput = &lambda.CreateEventSourceMappingInput{
		EventSourceArn: aws.String(getQueueARNResult.Attributes["QueueArn"]),
		FunctionName:   getParameterHandleMessageQueueARNResult.Parameter.ARN,
	}

	addEventSourceQueueResult, err := lambdaClient.CreateEventSourceMapping(ctx, addEventSourceQueueInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to add new channel's queue as an event source to the lambda handleMessageQueue: %v", err)
	}
	fmt.Printf("addEventSourceQueueResult\n %v", addEventSourceQueueResult)

	// ENDING

	// Add channel's complete info for all service into the meta channel info table.
	var putItemChannelInfoInput *dynamodb.PutItemInput = &dynamodb.PutItemInput{
		TableName: aws.String("MetaChannelTable"),
		Item: map[string]dynamodbTypes.AttributeValue{
			"Name": &dynamodbTypes.AttributeValueMemberS{
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
		},
	}

	// Send a JSON body for the return response from API Gateway to the client webserver with any potentially desired information about the newly created channel.

	rawReturnBody := map[string]interface{}{
		"Name":             choiceName,
		"TableARN":         createTableResult.TableDescription.TableArn,
		"QueueARN":         getQueueARNResult.Attributes["QueueArn"],
		"EndpointTopicARN": createEndpointTopicResult.TopicArn,
	}

	cleanReturnBody, err := json.Marshal(rawReturnBody)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to marshal JSON version of return body response: %v", err)
	}
	fmt.Printf("cleanReturnBody\n %v", cleanReturnBody)

	putItemChannelInfoResult, err := dynamoClient.PutItem(ctx, putItemChannelInfoInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to put new channel's complete info into meta info table")
	}
	fmt.Printf("putItemChannelInfoResult\n %v", putItemChannelInfoResult)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       string(cleanReturnBody),
	}, nil
}

func main() {
	invokedLambda.Start(handleCreateChannelRequest)
}
