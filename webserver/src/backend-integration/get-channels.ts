const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

export type ChannelInfo = {
    Name: { Value: string }
    EndpointTopicARN: { Value: string }
    QueueARN: { Value: string }
    TableARN: { Value: string }
}[]

export const getChannels = async () =>
    await fetch(`${url}/getChannel?type=all`, { method: "GET" })
        .then(response => {
            const r = response.json()
            console.log(JSON.stringify(r))

            return r
        })
        .then(data => data.channels as ChannelInfo)
        .catch(error => console.error(error))