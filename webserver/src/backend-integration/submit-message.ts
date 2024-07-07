const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

export const submitMessage = async (
        message: { 
            channel: string, 
            account: string, 
            timestamp: string, 
            message: string 
        }
    ) => 
        await fetch(
            `${url}/sendMessage/`, 
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(message)
            }
        )