export type SubscriptionConfirmation = {
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

export type Notification = {
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
