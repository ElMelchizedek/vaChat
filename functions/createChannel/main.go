package main

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
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

	// Create new channel's table.
	var createTableInput *dynamodb.CreateTableInput = &dynamodb.CreateTableInput{
		AttributeDefinitions: []types.AttributeDefinition{
			// TODO: Add IDs as primary key instead of names.
			{
				AttributeName: aws.String("Account"),
				AttributeType: types.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("Time"),
				AttributeType: types.ScalarAttributeTypeN,
			},
			{
				AttributeName: aws.String("Content"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("Account"),
				KeyType:       types.KeyTypeHash,
			},
			{
				AttributeName: aws.String("Time"),
				KeyType:       types.KeyTypeRange,
			},
		},
		GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{
			{
				IndexName: aws.String("AccountContent"),
				KeySchema: []types.KeySchemaElement{
					{
						AttributeName: aws.String("Account"),
						KeyType:       types.KeyTypeHash,
					},
					{
						AttributeName: aws.String("Content"),
						KeyType:       types.KeyTypeRange,
					},
				},
				Projection: &types.Projection{
					NonKeyAttributes: []string{
						"Time",
					},
					ProjectionType: types.ProjectionTypeAll,
				},
			},
		},
	}

	var client *dynamodb.Client = dynamodb.NewFromConfig(cfg)

	createTableResult, err := client.CreateTable(ctx, createTableInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to create new channel's table: %v", err)
	}
	fmt.Printf("createTableResult\n %v", createTableResult)

	// Put the new channel's table's name and ARN into MetaChannelTable.
	var putItemNameARNMetaTableInput *dynamodb.PutItemInput = &dynamodb.PutItemInput{
		TableName: aws.String("MetaChannelTable"),
		Item: map[string]types.AttributeValue{
			"Name": &types.AttributeValueMemberS{
				Value: choiceName,
			},
			"ARN": &types.AttributeValueMemberS{
				Value: *createTableResult.TableDescription.TableArn,
			},
		},
	}

	putItemNameARNMetaTableResult, err := client.PutItem(ctx, putItemNameARNMetaTableInput)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to put new channel's name and ARN into meta info table: %v", err)
	}
	fmt.Printf("putItemNameARNMetaTableResult\n %v", putItemNameARNMetaTableResult)

	//

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleCreateChannelRequest)
}
