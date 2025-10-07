import { useContext, useEffect, useRef, type ReactNode } from "react"
import { MPContext, type PeerState } from "./MP"

export default function ChatBox({ consoleMessages, chatInput, setChatInput, sendChat, setConsoleMessages }: {
    consoleMessages: Array<{ peer: string, message: string | ReactNode }>,
    chatInput: string,
    setChatInput: React.Dispatch<React.SetStateAction<string>>,
    sendChat: (msg: string) => void,
    setConsoleMessages: React.Dispatch<React.SetStateAction<Array<{ peer: string, message: string | ReactNode }>>>
}) {
    const { peerStates, myState } = useContext(MPContext);
    const chatListRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (chatListRef.current) {
            chatListRef.current.scrollTop = chatListRef.current.scrollHeight
        }
    }, [consoleMessages])

    const isMe = (peerId: string) => { return peerId === 'me' }
    const myName = myState?.profile?.name || 'me';

    return (
        <div className='flex flex-col w-full'>
            {/* LCD display area */}
            <div
                ref={chatListRef}
                className="h-full overflow-y-auto text-[13px] mb-1 font-mono noscrollbar px-1 py-1 mt-1 mx-1"
            >
                {consoleMessages.map((msg, i) => (
                    <div
                        key={i}
                        className="text-left mb-0.5 border rounded-md px-1 py-0.5 bg-white/10 animate-[zoomIn_0.3s_ease]"
                        style={{
                            animationName: 'zoomIn',
                            animationDuration: '0.3s',
                            animationTimingFunction: 'ease',
                        }}
                    >
                        <span className={`${isMe(msg.peer) ? 'text-[#000eee]' : peerStates[msg.peer]?.profile?.name ? 'text-[#1976d2]' : ''} font-bold`}>
                            {isMe(msg.peer) ? myName : peerStates[msg.peer]?.profile?.name || msg.peer.slice(0, 8)}
                        </span>
                        <span>: {msg.message}</span>
                    </div>
                ))}

                <style>
                    {`
                @keyframes zoomIn {
                  0% {
                    transform: scale(0.7);
                    opacity: 0;
                  }
                  100% {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
                `}
                </style>
            </div>
            <div className="flex flex-row border-t bg-black/20 pb-1 px-1">
                <span className={`${isMe('me') ? 'text-[#000eee]' : 'text-[#1976d2]'} font-bold pr-1`}>
                    {myState?.profile.name || 'anon'}:
                </span>
                <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && chatInput.trim()) {
                            sendChat(chatInput)
                            setConsoleMessages(msgs => [...msgs, { peer: 'me', message: chatInput }])
                            setChatInput('')
                        }
                        e.stopPropagation()
                    }}
                    placeholder="Type a message..."
                    className="w-full outline-none text-[13px] font-mono"
                />
            </div>

        </div>
    )
}