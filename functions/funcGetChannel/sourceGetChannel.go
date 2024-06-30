package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func HandleChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("ap-southeast-2"),
	)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("Failed to initialise SDK with default configuration: %v", err)
	}

	client := dynamodb.NewFromConfig(cfg)

	input := &dynamodb.GetItemInput{
		// Temp name
		TableName: aws.String("ChannelTable"),
		Key: map[string]types.AttributeValue{
			"PrimaryKey": &types.AttributeValueMemberS{
				Value: "VALUE_HERE",
			},
		},
		ProjectionExpression: aws.String("ARN"),
	}

	resp, err := client.GetItem(ctx, input)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("DynamoDB GetItem command failed: %v", err)
	}

	// Check if the item was found
	if resp.Item == nil {
		return events.APIGatewayProxyResponse{StatusCode: 404, Body: "Failed to get specified item from ChannelTable"}, nil
	}

	// Extract and prepare the response
	attributeValue, found := resp.Item["attributeName"]
	if !found {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("Failed to get specified attribute \"ARN\" from ChannnelTable")
	}
	responseBody := fmt.Sprintf("Specified Channel ARN: %s", attributeValue.(*types.AttributeValueMemberS).Value)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       responseBody,
	}, nil
}

func main() {
	lambda.Start(HandleChannelRequest)
}
