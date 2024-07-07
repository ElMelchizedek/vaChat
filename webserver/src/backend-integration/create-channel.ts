const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

export const createChannel = async (name: string) =>
    await fetch(
        `${url}/createChannel/`,
        { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ name })
        }
    )
        .then(response => response.json())
        .then(
            data => data.channels as {
                Name: string
                EndpointTopicARN: string
                QueueARN: string
                TableARN: string
            }
        )
        .catch(error => console.error(error))