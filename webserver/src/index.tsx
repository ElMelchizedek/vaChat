import { Elysia, t } from 'elysia'
import { html } from '@elysiajs/html'
import { Client, Message } from './client'

import { SNS } from "@aws-sdk/client-sns-node"

// channels' message histories and listeners
const channels = new Map<string, {listeners: string[], history: string[]}>()
channels.set("main", {listeners: [], history: []})
channels.set("other", {listeners: [], history: []})

// maps session IDs to Client handlers
const sessions = new Map<string, Client>()

const sns = new SNS({ 
    region: "ap-southeast-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
})

// user signs in
// user lands on their homepage
//   user info is grabbed during, including notifications inbox
//   user's available channels are grabbed
// homepage shows links that will take user to a channel they have access to
//   grab paginated history of messages for that channel
//   subscrieb

new Elysia()
    .use(html())

    .get('/', ({ set }) => {
        let sessionId = ""
        do {
            sessionId = Math.random().toString(36).substring(2)
        } while(sessions.has(sessionId))

        set.headers['Set-Cookie'] = `session=${sessionId}; SameSite=Strict`

        return (
            <html lang='en'>
                <head>
                    <title>Message others</title>

                    <script src="https://unpkg.com/htmx.org@2.0.0"></script>
                    <script src="https://unpkg.com/htmx-ext-ws@2.0.0/ws.js"></script>
                </head>

                <body  hx-ext="ws" ws-connect="/ws-main">
                    <h1>Message others</h1>
                    
                    <select id="channel" name="channel" hx-get="/channels" hx-trigger="change" hx-target="#messages" hx-swap="outerHTML">
                        <option value="main">Main</option>
                        <option value="other">Other</option>
                    </select>

                    <div id="messages"></div>

                    <form id="write-message" hx-include="#channel" ws-send>
                        <input name="message" />
                    </form>
                </body>
            </html>
        )
    })

    .get('/channels', 
        ({ query, cookie }) => {
            // remove listener from previous channel
            channels.forEach(channel => {
                channel.listeners = channel.listeners.filter(listener => listener !== cookie.session.value)
            })

            // add listener to new channel
            channels.get(query.channel)!.listeners.push(cookie.session.value)

            return (
                <div id="messages">
                    {
                        channels.get(query.channel)!.history.map(
                            msg => <Message>{msg}</Message>
                        )
                    }
                </div>
            )
        },
        {
            query: t.Object({
                channel: t.String()
            })
        }
    )

    .ws('/ws-main', {
        // runs whenever a new WebSocket connection is opened
        open(ws) {
            const sessionId = ws.data.cookie.session.value

            // setup Client handler for new WebSocket connection
            sessions.set(sessionId, new Client(ws.send))

            // send message history to new session
            sessions.get(sessionId)!.sendMessage(channels.get("main")!.history)

            channels.get("main")!.listeners.push(sessionId)
        },

        // runs every time a message is sent over a WebSocket connection
        message(ws, content) {
            const { channel, message } = content as { channel: string, message: string }

            // push new message to appropriate channel history
            channels.get(channel)!.history.push(message)

            // send the message to every session listening to the channel this message was posted to
            channels.get(channel)!.listeners.forEach(listener => {
                sessions.get(listener)!.sendMessage(message)
            })
        },

        // runs whenever a WebSocket connection is closed
        close(ws) {
            // delete session entry for the closed WebSocket
            sessions.delete(ws.data.cookie.session.value)

            // remove the session from all channel listeners
            channels.forEach(channel => {
                channel.listeners = channel.listeners.filter(listener => listener !== ws.data.cookie.session.value)
            })
        }
    })

    .post('/sns', 
        async ({ body, headers }) => {
            const messageType = headers["x-amz-sns-message-type"]

            switch(messageType) {
                case "SubscriptionConfirmation":
                    const item = JSON.parse(body) as {
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
        
                    await sns.confirmSubscription({
                        Token: item.Token!,
                        TopicArn: item.TopicArn!
                    })

                    console.log("Subscription confirmed")
                    break

                default:
                    // console.log("Unknown message type")
                    console.log(body)
            }
        }, 
        {
            body: t.String(),
            headers: t.Object({
                "x-amz-sns-message-type": t.String()
            })
        }
    )

    .listen(3000)

// const protocol = "http"
// await sns.subscribe({
//     Protocol: protocol,
//     TopicArn: process.env.TOPIC_ARN!,
//     Endpoint: `${protocol}://${process.env.IP}:3000/sns`
// })