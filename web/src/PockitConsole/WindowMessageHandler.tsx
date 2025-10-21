import { useEffect } from "react";

export default function WindowMessageHandler(
    { sendChat }: { sendChat?: (message: string) => void }
) {
    // const [knownOrigins, setKnownOrigins] = ['https://pockit.world', 'https://draw.pockit.world', "*"];
    // use this component to bridge window.ethereum calls from the parent to our own ethereum provider.
    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const { type, payload, source } = event.data;
            if (source !== window.parent) {
                // return; // only accept messages from the parent window
            }

            if (type === 'CUSTOM_EVENT') {
                console.log('Received CUSTOM_EVENT with payload:', payload);
                // Handle the custom event
            } else if (type === 'POCKIT_CHAT_SEND') {
                console.log('Received POCKIT_CHAT_SEND with payload:', payload);
                if (sendChat && payload?.message) {
                    sendChat(payload.message);
                }
                // Handle the POCKIT_CHAT_SEND event
            } else if (type === 'ping') {
                console.log('Received ping, sending pong');
                window.parent.postMessage({ type: 'pong' }, '*');
            }
        }

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // todo track pending requests with a promise and resolve them when we get a response, use a nonce to identify them

    return null;
}