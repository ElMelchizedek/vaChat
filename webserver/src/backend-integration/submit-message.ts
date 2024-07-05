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
    ) => { 
        const requestURL: string = `${url}/sendMessage`;
        console.log(`URL\n${requestURL}\n`);
        try {
            console.log("message before send: ", message);
            const response = await fetch(requestURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
            });
            if (!response.ok) {
                throw new Error(`Failed to perform POST request on /sendMessage: ${response}`);
            }
            console.log("\nResponse\n", response);
            const json = await response.json();
            console.log("\nJSON\n", json);
            const strinigified = await JSON.stringify(json);
            console.log("\nStringified\n", strinigified);
            return json;
            } catch (error) {
                let message = "Unknown Error";
                if (error instanceof Error) {
                    message = error.message
                }
                console.log(message)
            }
        }