
import { credentials } from "./credentials"
import { SNS } from "@aws-sdk/client-sns"

const sns = new SNS({ 
    region: "ap-southeast-2",
    credentials
})

type SubscriptionConfirmation = {
    Type: string,
    Token: string,
    TopicArn: string,
    Message: string,
    SubscribeUrl: string,
    Timestamp: string,
    SignatureVersion: string,
    Signature: string,
    SigningCertURL: string,
}

type Notification = {
    Type: string,
    MessageId: string,
    TopicArn: string,
    Subject: string,
    Message: string,
    Timestamp: string,
    SignatureVersion: string,
    Signature: string,
    SigningCertURL: string,
    UnsubscribeURL: string,
    MessageAttributes: {
        [key: string]: {
            Type: string,
            Value: string,
        }
    }
}

import { Elysia, t } from 'elysia'

export const snsIngest = async (updateClients: (message: Notification) => void) =>
    (app: Elysia) => {
        return app.post(
            '/sns-ingest', 
            async ({ headers, body }) => {
                const messageType = headers["x-amz-sns-message-type"]

                switch(messageType) {
                    case "SubscriptionConfirmation": {
                        const message = JSON.parse(body) as SubscriptionConfirmation
            
                        await sns.confirmSubscription({
                            Token: message.Token,
                            TopicArn: message.TopicArn
                        })

                        console.log("Subscription confirmed")

                        break
                    }

                    case "Notification": {
                        const message = JSON.parse(body) as Notification

                        updateClients(message)

                        console.log("Message received: ", message.Message)

                        break
                    }

                    case "UnsubscribeConfirmation": {
                        console.log("Unsubscribe confirmation received")

                        break
                    }

                    default: {
                        console.log("Unknown message type: ", messageType)
                        console.log("Message: ", body)
                    }
                }
            }, 
            {
                headers: t.Object({
                    "x-amz-sns-message-type": t.String()
                }),
                
                body: t.String()
            }
        )
    }

export const subscribeToChannel = async (channel: string) =>
    await sns.subscribe({
        Protocol: "http",
        TopicArn: channel,
        Endpoint: `http://${process.env.IP}:3000/sns-ingest`
    })