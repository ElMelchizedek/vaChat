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
    constructor(ws_send: (content: string) => void) {
        this.send = ws_send;
    }

    public async sendMessage(accountId: string, content: string | string[]) {
        this.send(await
            <div id="messages" hx-swap-oob="beforeend">
                {
                    typeof content === 'string'
                        ? (
                            <Message {...{accountId}}>
                                {content}
                            </Message>
                        ) : (
                            content.map(
                                msg => 
                                    <Message {...{accountId}}>
                                        {msg}
                                    </Message>
                            )
                        )
                }
            </div>
        )
    }

    private send: (content: string) => void;
}