import { Elysia, t } from 'elysia'

import { SNS } from "@aws-sdk/client-sns"

import { credentials } from "./credentials"

const {
    WEBSERVER_IP: IP,
    SNS_PROTOCOL: protocol,
    WEBSERVER_PORT: port,
    SNS_PATH: path,
} = process.env

if(!IP) {
    throw new Error("IP environment variable not set")
} else if(!protocol) {
    throw new Error("SNS_PROTOCOL environment variable not set")
} else if(!port) {
    throw new Error("WEBSERVER_PORT environment variable not set")
} else if(!path) {
    throw new Error("SNS_PATH environment variable not set")
}

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

const sns = new SNS({ 
    region: "ap-southeast-2",
    credentials
})

export const subscribeToChannel = async (channel: string) =>
    await sns.subscribe({
        Protocol: protocol,
        TopicArn: channel,
        Endpoint: `${protocol}://${IP}:${port}/${path}`
    })


// TODO: handle message validation from SNS
// ....: UnsubscribeConfirmation    
export const snsIngest = async (updateClients: (message: Notification) => void) =>
    (app: Elysia) =>
        app.post(
            `/${path}`, 
            async ({ headers, body }) => {
                const messageType = headers["x-amz-sns-message-type"]
                console.log(body);
                switch(messageType) {
                    case "SubscriptionConfirmation": {
                        const message = JSON.parse(body) as SubscriptionConfirmation
            
                        const subscriptionConfirmation = await sns.confirmSubscription({
                            Token: message.Token,
                            TopicArn: message.TopicArn
                        })

                        console.log("Subscription Confirmation Message:\n", JSON.stringify(subscriptionConfirmation))
                        console.log("Subscription confirmed")

                        break
                    }

                    case "Notification": {
                        const message = JSON.parse(body) as Notification

                        console.log("SNS Message received: ", message.Message)

                        updateClients(message)
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