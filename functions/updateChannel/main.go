package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	// lambdaService "github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

type Request struct {
	Action     string              `json:"action"`
	Parameters []map[string]string `json:"parameters"`
}

type Body struct {
	Channel string  `json:"channel"`
	Account string  `json:"account"`
	Request Request `json:"request"`
}

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

// *** Per-action handler functions *** //
func ChangeChannelName(ctx context.Context, channel string, name string, cfg *aws.Config) {
	// Iniitalise service clients.
	var dynamoClient *dynamodb.Client = dynamodb.NewFromConfig(*cfg)
	var snsClient *sns.Client = sns.NewFromConfig(*cfg)
	// var lambdaClient *lambdaService.Client = lambdaService.NewFromConfig(*cfg)

	// Get ID of channel.
	var getChannelIDInput *dynamodb.ScanInput = &dynamodb.ScanInput{
		TableName:        aws.String("MetaChannelTable"),
		FilterExpression: aws.String(fmt.Sprintf("%s = :v", "Alias")),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":v": &types.AttributeValueMemberS{
				Value: channel,
			},
		},
	}
	getChannelIDResult, err := dynamoClient.Scan(ctx, getChannelIDInput)
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

	// Get channel info from MetaChannelTable.
	var getChannelInfoInput *dynamodb.GetItemInput = &dynamodb.GetItemInput{
		TableName: aws.String("MetaChannelTable"),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{
				Value: channelID,
			},
		},
	}
	getChannelInfoResult, err := dynamoClient.GetItem(ctx, getChannelInfoInput)
	errorHandle("failed to get channel's entry in MetaChannelTable", err, true)
	// Extract the channel's subscription ARN.
	subscriptionARNAttribute := getChannelInfoResult.Item["SubscriptionARN"].(*types.AttributeValueMemberS)
	if subscriptionARNAttribute == nil {
		errorHandle("failed to get subscription ARN from channel's info stored in MetaChannelTable", nil, false)
	}
	subscriptionARN := subscriptionARNAttribute.Value

	// Update channel's entry in MetaChannelTable.
	var updateChannelEntryInput *dynamodb.UpdateItemInput = &dynamodb.UpdateItemInput{
		TableName: aws.String("MetaChannelTable"),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{
				Value: channelID,
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
	//updateChannelEntryResult
	_, err = dynamoClient.UpdateItem(ctx, updateChannelEntryInput)
	errorHandle("failed to update the name entry for the specified channel in MetaChannelTable", err, true)

	// Create new filter policy
	rawNewFilter := map[string]interface{}{
		"channel": []string{name},
	}
	cleanNewFilter := cleanSelfMadeJson(rawNewFilter)

	// Change the subscription filter policy of the channel's queue to reflect the name change.
	var updateChannelQueueSubscriptionFilterPolicyInput *sns.SetSubscriptionAttributesInput = &sns.SetSubscriptionAttributesInput{
		SubscriptionArn: aws.String(subscriptionARN),
		AttributeName:   aws.String("FilterPolicy"),
		AttributeValue:  aws.String(cleanNewFilter),
	}
	_, err = snsClient.SetSubscriptionAttributes(ctx, updateChannelQueueSubscriptionFilterPolicyInput)
	errorHandle("failed to update new filter policy for specified channel", err, true)
}

// The actual logic.
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
		ChangeChannelName(ctx, data.Channel, data.Request.Parameters[0]["name"], &cfg)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleUpdateChannelRequest)
}
