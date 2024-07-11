const {
    API_URL: url
} = process.env

if(!url) {
    throw new Error("API_URL environment variable not set")
}

export const createChannel = async (name: string) => {
    const requestURL: string = `${url}/createChannel`;
    console.log(`URL\n${requestURL}\n`);
    try {
        const response = await fetch(requestURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: name,
        });

        if (!response.ok) {
            throw new Error(`Failed to perform POST request on /createChannel: ${response}`);
        }

        console.log("\nResponse\n", response);

        const json = await response.json();
        console.log("\nJSON\n", json);

        const strinigifed = JSON.stringify(json);
        console.log("\nStringified\n", strinigifed);

        return json;
    } catch (error) {
        let message = "Unknown Error";

        if (error instanceof Error) {
            message = error.message
        }

        console.log(message)
    }
}