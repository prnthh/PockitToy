import { useEffect } from "react";

export default function WindowMessageHandler() {
    // const [knownOrigins, setKnownOrigins] = ['https://pockit.world', 'https://draw.pockit.world', "*"];

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            console.log('Received message:', event);
            const { type, payload } = event.data;
            if (type === 'CUSTOM_EVENT') {
                console.log('Received CUSTOM_EVENT with payload:', payload);
                // Handle the custom event
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