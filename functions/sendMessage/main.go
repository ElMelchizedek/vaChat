package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sns/types"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

type MessageContents struct {
	Message   string `json:"message"`
	Channel   string `json:"channel"`
	Account   string `json:"account"`
	Timestamp string `json:"timestamp"`
}

func sendMsg(ctx context.Context, contents MessageContents, ARN string) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}
	client := sns.NewFromConfig(cfg)

	input := &sns.PublishInput{
		TargetArn: &ARN,
		Message:   &contents.Message,
		MessageAttributes: map[string]types.MessageAttributeValue{
			"channel": {
				DataType:    aws.String("String"),
				StringValue: aws.String(contents.Channel),
			},
			"account": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(contents.Account),
			},
			"timestamp": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(contents.Timestamp),
			},
		},
	}

	result, err := client.Publish(ctx, input)
	if err != nil {
		log.Printf("Error executing PublishCommand: %s", err)
		return
	}

	log.Println("Publish result:", result)
}

func getMetaTopicARN(ctx context.Context) string {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}
	client := ssm.NewFromConfig(cfg)

	paramName := fmt.Sprintf("metaTopicARN")
	input := &ssm.GetParameterInput{
		Name: &paramName,
	}

	result, err := client.GetParameter(ctx, input)
	if err != nil {
		log.Printf("Error executing GetParameterCommand: %s", err)
		return ""
	}
	return *result.Parameter.Value
}

func handler(ctx context.Context, event json.RawMessage) {
	// log event
	log.Printf("Event: %s", event)

	var eventObj map[string]interface{}
	json.Unmarshal(event, &eventObj)

	// log rawContents
	log.Printf("Event Object: %s", eventObj)

	var body map[string]interface{}
	json.Unmarshal([]byte(eventObj["body"].(string)), &body)

	log.Printf("Body: %s", body)

	contents := MessageContents{
		Message:   body["message"].(string),
		Channel:   body["channel"].(string),
		Account:   body["account"].(string),
		Timestamp: body["timestamp"].(string),
	}

	metaTopicARN := getMetaTopicARN(ctx)
	sendMsg(ctx, contents, metaTopicARN)
}

func main() {
	lambda.Start(handler)
}
