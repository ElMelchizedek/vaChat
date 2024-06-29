type NewMessage = {
    channel: string,
    account: string,
    timestamp: string,
    message: string
}

export const submitMessage = async (message: NewMessage) =>
    await fetch(
        process.env.SUBMIT_URL!, 
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ 
                "channel": "Main", 
                "account": "1", 
                "timestamp": Date.now().toString(), 
                message 
            })
        })