import { Elysia } from "elysia"
import { Client } from "./client"
import { submitMessage, createChannel, ChannelInfo } from "../backend-integration"

export const ws = (sessions: Map<string, Client>, channelInfo: ChannelInfo) =>
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
                            channelInfo.map(({ Name }) => Name.Value),
                            channelInfo[0].Name.Value
                        )
                    )

                    // subscribe to user's landing channel

                    // send history to afterbegin of messages div
                    // (filter history for messages received via subscription)

                    console.log("Client connected")
                },

                // runs every time a message is sent over a WebSocket connection
                async message(ws, message) {
                    console.log(JSON.stringify(message))

                    const client = sessions.get(ws.data.cookie.session.value)!

                    const msg = message as any;

                    switch(msg.messageType) {
                        case "changeChannel":
                            client.subscribedTo = msg.channel

                            await client.clearHistory()

                            break
                        case "newChannel":
                            const newChannel = await createChannel(msg.newChannel)

                            if(!newChannel) {
                                console.log("Failed to create new channel")
                            } else {
                                channelInfo.push(newChannel)

                                client.channels.push(newChannel.Name.Value)

                                client.subscribedTo = newChannel.Name.Value

                                await client.clearHistory()
                            }

                            break
                        case "submitMessage":
                            console.log("Submit message response:", JSON.stringify(
                                await submitMessage({
                                    channel: msg.channel,
                                    account: "1",
                                    timestamp: Date.now().toString(),
                                    message: msg.message,
                                    topic: channelInfo.find(({ Name }) => Name.Value === msg.channel)!.EndpointTopicARN.Value
                                })
                            ))

                            break
                        default:
                            console.log("Invalid message")
                    }
                },

                // runs whenever a WebSocket connection is closed
                close(ws) {
                    // delete session entry for the closed WebSocket
                    sessions.delete(ws.data.cookie.session.value)

                    console.log("Client disconnected")
                }
            }
        )