import { fromIni } from "@aws-sdk/credential-providers"

export const credentials = fromIni({
    profile: "harbour",
    filepath: process.env.HOME + "/.aws/credentials",
    configFilepath: process.env.HOME + "/.aws/config",
})