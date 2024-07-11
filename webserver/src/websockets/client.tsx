export function Message({ children, accountId }: { children: string, accountId: string}) {
    return <>
        <p style="">
            {accountId}
        </p>
        
        <p safe>
            {children}
        </p>
    </>
}

export class Client {
    constructor(
        ws_send: (content: JSX.Element) => void,
        channels: string[],
        subscribedTo: string
    ) {
        this.send = ws_send;
        this.channels = channels;
        this.subscribedTo = subscribedTo;
    }

    public async sendMessage(accountId: string, content: string | string[]) {
        this.send(
            <div id="messages" hx-swap-oob="beforeend">
                {
                    typeof content === 'string'
                        ? (
                            <Message {...{accountId}}>
                                {content}
                            </Message>
                        ) : (
                            content.map(
                                (msg) => 
                                    <Message {...{accountId}}>
                                        {msg}
                                    </Message>
                            )
                        )
                }
            </div>
        )
    }

    public async sendHistory(history: string[]) {}

    public async clearHistory() {
        this.send(
            <div id="messages" hx-swap-oob="outerHTML" />
        )
    }

    private send: (content: JSX.Element) => void;
    
    public channels: string[];
    public subscribedTo: string;
}