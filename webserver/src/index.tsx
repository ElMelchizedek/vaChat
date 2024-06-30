import { Elysia, t } from 'elysia'
import { html } from '@elysiajs/html'

import {
    snsIngest,
    subscribeToChannel
} from './backend-integration'

import {
    ws,
    Client
} from './websockets'

// maps session IDs to Client handlers
const sessions = new Map<string, Client>()

new Elysia()
    .use(html())

    .get(
        '/', 
        ({ set }) => {
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

                        <div id="messages"></div>

                        <form id="write-message" ws-send>
                            <input name="message" />
                        </form>
                    </body>
                </html>
            )
        }
    )

    .use(ws(sessions))

    .use(
        snsIngest(
            // send message to clients
            (message) => {
                sessions.forEach(
                    (client) => {
                        client.sendMessage(
                            message.MessageAttributes.account.Value, 
                            message.Message
                        )
                    }
                )
            }
        )
    )

    .listen(3000)

console.log("Subscribing to channel")
console.log(JSON.stringify(await subscribeToChannel(process.env.TOPIC_ARN!)))