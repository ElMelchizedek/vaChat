import { Elysia, t } from 'elysia'
import { html } from '@elysiajs/html'

import {
    snsIngest,
    subscribeToChannel,
    getChannels,
    createChannel
} from './backend-integration'

import {
    ws,
    Client
} from './websockets'

const {
    WEBSERVER_PORT: port
} = process.env

if(!port) {
    throw new Error("WEBSERVER_PORT environment variable not set")
}

// maps session IDs to Client handlers
const sessions = new Map<string, Client>()

const channelInfo = await getChannels() || []

for(const channel of channelInfo) {
    await subscribeToChannel(channel.EndpointTopicARN.Value)
}

if(channelInfo.length === 0) {
    // create default Main channel
    const newChannel = await createChannel("Main")

    if(!newChannel) {
        throw new Error("Failed to create Main channel")
    }

    // subscribe to Main
    await subscribeToChannel(newChannel.EndpointTopicARN)

    channelInfo.push({
        Name: { Value: newChannel.Name },
        EndpointTopicARN: { Value: newChannel.EndpointTopicARN },
        QueueARN: { Value: newChannel.QueueARN },
        TableARN: { Value: newChannel.TableARN }
    })
}

new Elysia()
    .use(html())

    .get(
        '/', 
        async ({ set }) => {
            // TODO: sessionId is not unique for individual tabs.
            // ....: Need to generate a unique ID for each tab.
            // ....: how get this information to a normal hx get...
            // ....: can't use a cookie for this
            // ....: want the id to be secure

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

                        <select id="channel-select" name="channel" hx-post="/changeChannel" hx-trigger="change">
                            {
                                channelInfo.map(
                                    (channel) =>
                                        <option value={channel.Name.Value}>{channel.Name.Value}</option>
                                )
                            }
                        </select>

                        <div id="messages"></div>

                        <form id="write-message" hx-include="#channel-select" ws-send>
                            <input name="message" />
                        </form>
                    </body>
                </html>
            )
        }
    )

    .get('/changeChannel', 
        async ({ query, cookie }) => {
            const sessionId = cookie.session.value

            const client = sessions.get(sessionId)!
            client.subscribedTo = query.channel

            return <div id="messages" hx-swap-oob="outerHTML" />
        }, 
        {
            query: t.Object({
                channel: t.String()
            }),
            cookie: t.Object({
                session: t.String()
            })
        }
    )

    .use(ws(sessions, channelInfo))

    .use(
        snsIngest(
            // send message to clients
            (message) => {
                sessions.forEach(
                    (client) => {
                        if (client.subscribedTo === message.MessageAttributes.channel.Value) {
                            client.sendMessage(
                                message.MessageAttributes.account.Value, 
                                message.Message
                            )
                        }
                    }
                )
            }
        )
    )

    .listen(+port)
