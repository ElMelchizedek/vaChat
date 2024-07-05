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

export const getChannels = async () => {
    const requestURL: string = `${url}/getChannel?type=all`;
    console.log(`URL\n${requestURL}\n`);
    try {
        const response = await fetch (requestURL, {method: "GET"});
        if (!response.ok) {
            throw new Error(`Failed to perform GET request on /getChannel: ${response}`);
        }
        console.log("\nResponse\n", response);

        const json = await response.json();
        console.log("\nJSON\n", json);
        return json as ChannelInfo;
    } catch (error) {
        let message = "Unknown Error";
        if (error instanceof Error) {
            message = error.message
        }
        console.log(message)
    }
}