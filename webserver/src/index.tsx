import { Elysia, t } from 'elysia'
import { html } from '@elysiajs/html'
import { Client, Message } from './client'

import { fromIni } from "@aws-sdk/credential-providers"

import { SubscriptionConfirmation, Notification } from './snsMessageTypes'
import { SNS } from "@aws-sdk/client-sns"

const credentials = fromIni({
    profile: "harbour",
    filepath: process.env.HOME + "/.aws/credentials",
    configFilepath: process.env.HOME + "/.aws/config",
})

const sns = new SNS({ 
    region: "ap-southeast-2",
    credentials
})

// channels' message histories and listeners
const channel: string[] = []

// maps session IDs to Client handlers
const sessions = new Map<string, Client>()

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
                    
                    {/* <select id="channel" name="channel" hx-get="/channels" hx-trigger="change" hx-target="#messages" hx-swap="outerHTML">
                        <option value="main">Main</option>
                        <option value="other">Other</option>
                    </select> */}

                    <div id="messages"></div>
                    
                    {/* hx-include="#channel" */}
                    <form id="write-message" ws-send>
                        <input name="message" />
                    </form>
                </body>
            </html>
        )
    })

    // .get('/channels', 
    //     ({ query, cookie }) => {
    //         // remove listener from previous channel
    //         channels.forEach(channel => {
    //             channel.listeners = channel.listeners.filter(listener => listener !== cookie.session.value)
    //         })

    //         // add listener to new channel
    //         channels.get(query.channel)!.listeners.push(cookie.session.value)

    //         return (
    //             <div id="messages">
    //                 {
    //                     channels.get(query.channel)!.history.map(
    //                         msg => <Message>{msg}</Message>
    //                     )
    //                 }
    //             </div>
    //         )
    //     },
    //     {
    //         query: t.Object({
    //             channel: t.String()
    //         })
    //     }
    // )

    .ws('/ws-main', {
        // runs whenever a new WebSocket connection is opened
        open(ws) {
            const sessionId = ws.data.cookie.session.value

            // setup Client handler for new WebSocket connection
            sessions.set(sessionId, new Client(ws.send))

            // // send message history to new session
            // sessions.get(sessionId)!.sendMessage(channels.get("main")!.history)

            // channels.get("main")!.listeners.push(sessionId)
        },

        // runs every time a message is sent over a WebSocket connection
        message(ws, content) {
            const { message } = content as { message: string }

            // push new message to API gateway, with a POST request
            fetch("https://d3mcf0vo5h.execute-api.ap-southeast-2.amazonaws.com/sendMessage", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            })
        },

        // runs whenever a WebSocket connection is closed
        close(ws) {
            // delete session entry for the closed WebSocket
            sessions.delete(ws.data.cookie.session.value)
        }
    })

    .post('/sns-ingest', 
        async ({ headers, body }) => {
            const messageType = headers["x-amz-sns-message-type"]

            switch(messageType) {
                case "SubscriptionConfirmation": {
                    const message = JSON.parse(body) as SubscriptionConfirmation
        
                    await sns.confirmSubscription({
                        Token: message.Token!,
                        TopicArn: message.TopicArn!
                    })

                    break
                }

                case "Notification": {
                    const message = JSON.parse(body) as Notification

                    for(const client of sessions.values()) {
                        client.sendMessage(
                            message.MessageAttributes.accountId.Value,
                            message.Message
                        )
                    }

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
            body: t.String(),
            headers: t.Object({
                "x-amz-sns-message-type": t.String()
            })
        }
    )

    .listen(3000)

await sns.subscribe({
    Protocol: "http",
    TopicArn: process.env.TOPIC_ARN,
    Endpoint: `http://${process.env.IP}:3000/sns-ingest`
})