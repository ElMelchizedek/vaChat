const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

export const getChannels = async () =>
    await fetch(`${url}/getChannel/?type=all`, { method: "GET" })
        .then(response => response.json())
        .then(data => data.channels as { [key: string]: string })
        .catch(error => console.error(error))