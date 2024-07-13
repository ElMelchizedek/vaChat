package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snstypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
)

type SQSMessage struct {
	Message           string `json:"Message"`
	MessageAttributes struct {
		Channel struct {
			Value string `json:"Value"`
		} `json:"channel"`
		Account struct {
			Value string `json:"Value"`
		} `json:"account"`
		Timestamp struct {
			Value string `json:"Value"`
		} `json:"timestamp"`
	} `json:"MessageAttributes"`
}

type SQSEvent struct {
	Records []struct {
		Body string `json:"body"`
	} `json:"Records"`
}

func sendToTopic(ctx context.Context, snsClient *sns.Client, body SQSMessage) error {
	messageContent := body.Message
	messageChannel := body.MessageAttributes.Channel.Value
	messageAccount := body.MessageAttributes.Account.Value
	messageTime := body.MessageAttributes.Timestamp.Value

	_, err := snsClient.Publish(ctx, &sns.PublishInput{
		TargetArn: aws.String(messageChannel),
		Message:   &messageContent,
		MessageAttributes: map[string]snstypes.MessageAttributeValue{
			"account": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(messageAccount),
			},
			"timestamp": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(messageTime),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

func handler(ctx context.Context, event SQSEvent) error {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	dynamoClient := dynamodb.NewFromConfig(cfg)
	snsClient := sns.NewFromConfig(cfg)

	for _, record := range event.Records {
		var body SQSMessage
		if err := json.Unmarshal([]byte(record.Body), &body); err != nil {
			log.Printf("Failed to unmarshal SQS message: %v", err)
			continue
		}

		messageContent := body.Message
		messageChannel := body.MessageAttributes.Channel.Value
		messageAccount := body.MessageAttributes.Account.Value
		messageTime := body.MessageAttributes.Timestamp.Value

		tableName := messageChannel + "Table"

		messageAccountNum, err := strconv.Atoi(messageAccount)
		if err != nil {
			log.Printf("Failed to convert account to number: %v", err)
			continue
		}

		messageTimeNum, err := strconv.Atoi(messageTime)
		if err != nil {
			log.Printf("Failed to convert timestamp to number: %v", err)
			continue
		}

		_, err = dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: &tableName,
			Item: map[string]types.AttributeValue{
				"channel":   &types.AttributeValueMemberS{Value: messageChannel},
				"account":   &types.AttributeValueMemberN{Value: strconv.Itoa(messageAccountNum)},
				"timestamp": &types.AttributeValueMemberN{Value: strconv.Itoa(messageTimeNum)},
				"content":   &types.AttributeValueMemberS{Value: messageContent},
			},
		})
		if err != nil {
			log.Printf("Failed to put item into DynamoDB: %v", err)
			continue
		}

		if err := sendToTopic(ctx, snsClient, body); err != nil {
			log.Printf("Failed to send message to SNS topic: %v", err)
			continue
		}
	}

	return nil
}

func main() {
	lambda.Start(handler)
}
