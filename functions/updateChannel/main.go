package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	// lambdaService "github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

// *** STRUCTS *** //
type Request struct {
	Action     string              `json:"action"`
	Parameters []map[string]string `json:"parameters"`
}

type Body struct {
	Channel string  `json:"channel"`
	Account string  `json:"account"`
	Request Request `json:"request"`
}

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

// *** SERVICE FUNCTIONS *** //
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

	fmt.Printf("name in getChannelID:%v\n", name)

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

func getSubscriptionARN(name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan string) {
	getSubscriptionARNInput := dynamodb.ScanInput{
		TableName:        aws.String("MetaChannelTable"),
		FilterExpression: aws.String(fmt.Sprintf("%s = :v", "Alias")),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":v": &types.AttributeValueMemberS{
				Value: name,
			},
		},
	}

	getSubscriptionARNResult, err := dynamoClient.Scan(*ctx, &getSubscriptionARNInput)
	errorHandle("failed to scan MetaChannelTable to find subscription ARN of channel", err, true)

	if len(getSubscriptionARNResult.Items) == 0 {
		errorHandle("no results from scanning of subscription ARN for specified channel", nil, false)
	}

	var subscriptionARN string
	for _, item := range getSubscriptionARNResult.Items {
		subscriptionARN = item["SubscriptionARN"].(*types.AttributeValueMemberS).Value
	}
	if subscriptionARN == "" {
		errorHandle("could not find ID for specified channel", nil, false)
	}

	result <- subscriptionARN
}

func updateChannelEntry(id string, name string, ctx *context.Context, dynamoClient *dynamodb.Client, result chan *dynamodb.UpdateItemOutput) {
	updateChannelEntryInput := dynamodb.UpdateItemInput{
		TableName: aws.String("MetaChannelTable"),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberN{
				Value: id,
			},
		},
		UpdateExpression: aws.String("SET #attributeName = :attributeValue"),
		ExpressionAttributeNames: map[string]string{
			"#attributeName": "Alias",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":attributeValue": &types.AttributeValueMemberS{
				Value: name,
			},
		},
	}

	updateChannelEntryResult, err := dynamoClient.UpdateItem(*ctx, &updateChannelEntryInput)
	errorHandle("failed to update the name entry for the specified channel in MetaChannelTable", err, true)
	result <- updateChannelEntryResult
}

func updateSubscriptionFilter(name string, subscriptionARN string, ctx *context.Context, snsClient *sns.Client, result chan *sns.SetSubscriptionAttributesOutput) {
	rawFilter := map[string]interface{}{
		"channel": []string{name},
	}
	filter := cleanSelfMadeJson(rawFilter)

	updateSubscriptionFilterInput := sns.SetSubscriptionAttributesInput{
		SubscriptionArn: aws.String(subscriptionARN),
		AttributeName:   aws.String("FilterPolicy"),
		AttributeValue:  aws.String(filter),
	}
	updateSubscriptionFilterOutput, err := snsClient.SetSubscriptionAttributes(*ctx, &updateSubscriptionFilterInput)
	errorHandle("failed to update new filter policy for specified channel", err, true)
	result <- updateSubscriptionFilterOutput
}

// *** PER-ACTION FUNCTIONS *** //
func ChangeChannelName(ctx context.Context, channel string, newName string, cfg *aws.Config) {
	// Iniitalise service clients.
	var dynamoClient *dynamodb.Client = dynamodb.NewFromConfig(*cfg)
	var snsClient *sns.Client = sns.NewFromConfig(*cfg)
	// var lambdaClient *lambdaService.Client = lambdaService.NewFromConfig(*cfg)

	// Get ID of channel.
	getChannelIDChannel := make(chan string)
	go getChannelID(channel, &ctx, dynamoClient, getChannelIDChannel)
	channelID := <-getChannelIDChannel

	// Get the channel's subscription ARN.
	getSubscriptionARNChannel := make(chan string)
	go getSubscriptionARN(channel, &ctx, dynamoClient, getSubscriptionARNChannel)
	subscriptionARN := <-getSubscriptionARNChannel

	// Update channel's entry in MetaChannelTable.
	updateChannelEntryChannel := make(chan *dynamodb.UpdateItemOutput)
	go updateChannelEntry(channelID, newName, &ctx, dynamoClient, updateChannelEntryChannel)
	<-updateChannelEntryChannel

	// Change the subscription filter policy of the channel's queue to reflect the name change.
	updateSubscriptionFilterChannel := make(chan *sns.SetSubscriptionAttributesOutput)
	go updateSubscriptionFilter(newName, subscriptionARN, &ctx, snsClient, updateSubscriptionFilterChannel)
	<-updateSubscriptionFilterChannel
}

// *** MAIN LOGIC *** //
func handleUpdateChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var data Body

	// Convert string into inherent JSON suited up into Body struct.
	err := json.Unmarshal([]byte(request.Body), &data)
	errorHandle("error passing JSON", err, true)

	// Initialise AWS SDK.
	var cfg aws.Config
	cfg, err = config.LoadDefaultConfig(ctx,
		config.WithRegion("ap-southeast-2"),
	)
	errorHandle("failed to initialise SDK with default configuration", err, true)

	switch data.Request.Action {
	case "ChangeChannelName":
		if len(data.Request.Parameters) > 1 || len(data.Request.Parameters) == 0 {
			errorHandle("incorrect number of parameters provided for ChangeChannelName action", nil, false)
		}
		if _, ok := data.Request.Parameters[0]["name"]; !ok {
			errorHandle("key \"name\" not provided for ChangeChannelName action", nil, false)
		}
		fmt.Printf("name in main:%v\n", data.Request.Parameters[0]["name"])
		ChangeChannelName(ctx, data.Channel, data.Request.Parameters[0]["name"], &cfg)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleUpdateChannelRequest)
}
