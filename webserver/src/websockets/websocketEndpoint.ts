import { Elysia } from "elysia"
import { Client } from "./client"
import { submitMessage } from "../backend-integration"

export const ws = (sessions: Map<string, Client>) =>
    (app: Elysia) =>
        app.ws(
            '/ws-main', 
            {
                // runs whenever a new WebSocket connection is opened
                open(ws) {
                    const sessionId = ws.data.cookie.session.value
                    
                    // setup Client handler for new WebSocket connection
                    sessions.set(sessionId, new Client(ws.send))

                    // subscribe to user's landing channel

                    // send history to afterbegin of messages div
                    // (filter history for messages received via subscription)
                },

                // runs every time a message is sent over a WebSocket connection
                async message(ws, content) {
                    const { message } = content as { message: string }

                    // submit new message to backend system via API gateway
                    submitMessage({
                        channel: "Main",
                        account: "1",
                        timestamp: Date.now().toString(),
                        message
                    })
                },

                // runs whenever a WebSocket connection is closed
                close(ws) {
                    // delete session entry for the closed WebSocket
                    sessions.delete(ws.data.cookie.session.value)
                }
            }
        )