export function Message({ children }: { children: string }) {
    return <p safe>{children}</p>
}

export class Client {
    constructor(ws_send: (content: string) => void) {
        this.send = ws_send;
    }

    public async sendMessage(content: string | string[]) {
        this.send(await
            <div id="messages" hx-swap-oob="beforeend">
                {
                    typeof content === 'string'
                        ? <Message>{content}</Message>
                        : content.map(msg => <Message>{msg}</Message>)
                }
            </div>
        )
    }

    private send: (content: string) => void;
}