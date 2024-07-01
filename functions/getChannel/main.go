package main

import (
	"context"
	"fmt"
	"reflect"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

func printStructContents[T any](selectStruct T) {
	t := reflect.TypeOf(selectStruct)
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		value := reflect.ValueOf(selectStruct).Field(i).Interface()
		fmt.Printf("%s: %v\n", field.Name, value)
	}
}

type ReturnGetAllChannels struct {
	response events.APIGatewayProxyResponse
	err      error
	output   *dynamodb.ScanOutput
}

func getAllChannels(ctx *context.Context) ReturnGetAllChannels {
	var cfg aws.Config
	var err error
	cfg, err = config.LoadDefaultConfig(*ctx,
		config.WithRegion("ap-southeast-2"),
	)
	if err != nil {
		return ReturnGetAllChannels{
			events.APIGatewayProxyResponse{},
			fmt.Errorf("failed to initialise SDK with default configuration: %v", err),
			nil}
	}

	var client *dynamodb.Client = dynamodb.NewFromConfig(cfg)
	var input *dynamodb.ScanInput = &dynamodb.ScanInput{
		TableName: aws.String("ChannelTable"),
	}

	result, err := client.Scan(*ctx, input)
	if err != nil {
		return ReturnGetAllChannels{
			events.APIGatewayProxyResponse{},
			fmt.Errorf("failed to perform Scan function on table %v: %v", input.TableName, err),
			nil}
	}

	return ReturnGetAllChannels{
		events.APIGatewayProxyResponse{},
		nil,
		result}

}

func handleGetChannelRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	printStructContents(request)
	var query map[string]string = request.QueryStringParameters

	var choice string
	var response ReturnGetAllChannels

	if value, ok := query["type"]; !ok {
		return events.APIGatewayProxyResponse{}, nil
	} else {
		choice = value
	}

	switch choice {
	case "all":
		response = getAllChannels(&ctx)
	default:
		fmt.Println("Unsupported type specified.")
		return events.APIGatewayProxyResponse{}, nil
	}

	for key, value := range response.output.Items {
		fmt.Printf("Key: %v, Value: %v\n", key, value)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       response.response.Body,
	}, nil
}

func main() {
	lambda.Start(handleGetChannelRequest)
}
