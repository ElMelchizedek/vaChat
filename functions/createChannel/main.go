package main

import (
	"context"
	"fmt"
	"reflect"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
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

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleCreateChannelRequest)
}
