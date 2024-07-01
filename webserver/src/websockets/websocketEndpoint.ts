import { Elysia } from "elysia"
import { Client } from "./client"
import { submitMessage } from "../backend-integration"

export const ws = (sessions: Map<string, Client>, channelInfo: [string, string][]) =>
    (app: Elysia) =>
        app.ws(
            '/ws-main', 
            {
                // runs whenever a new WebSocket connection is opened
                open(ws) {
                    const sessionId = ws.data.cookie.session.value
                    
                    // setup Client handler for new WebSocket connection
                    sessions.set(
                        sessionId,
                        new Client(
                            ws.send,
                            channelInfo.map(([channel]) => channel),
                            channelInfo[0][0]
                        )
                    )

                    // subscribe to user's landing channel

                    // send history to afterbegin of messages div
                    // (filter history for messages received via subscription)

                    console.log("Client connected")
                },

                // runs every time a message is sent over a WebSocket connection
                async message(ws, content) {
                    const { message, channel } = content as { message: string, channel: string }

                    console.log("Message received: ", message)

                    // submit new message to backend system via API gateway
                    console.log("Submit message response:", JSON.stringify(await submitMessage({
                        channel: channel,
                        account: "1",
                        timestamp: Date.now().toString(),
                        message
                    })))
                },

                // runs whenever a WebSocket connection is closed
                close(ws) {
                    // delete session entry for the closed WebSocket
                    sessions.delete(ws.data.cookie.session.value)

                    console.log("Client disconnected")
                }
            }
        )