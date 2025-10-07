import { useEffect, useRef } from "react"
import { type PeerState } from "./MP"

export default function ChatBox({ peerStates, chatMessages, chatInput, setChatInput, sendChat, setChatMessages }: {
    peerStates: Record<string, PeerState>,
    chatMessages: Array<{ peer: string, message: string }>,
    chatInput: string,
    setChatInput: React.Dispatch<React.SetStateAction<string>>,
    sendChat: (msg: string) => void,
    setChatMessages: React.Dispatch<React.SetStateAction<Array<{ peer: string, message: string }>>>
}) {
    const chatListRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (chatListRef.current) {
            chatListRef.current.scrollTop = chatListRef.current.scrollHeight
        }
    }, [chatMessages])

    return (
        <div className='flex flex-col w-full'>
            {/* LCD display area */}
            <div
                ref={chatListRef}
                className="h-full overflow-y-auto text-[13px] mb-1 font-mono noscrollbar px-1 py-1"
            >
                {chatMessages.map((msg, i) => (
                    <div
                        key={i}
                        className="mb-0.5 border rounded px-1 py-0.5 bg-white/10 animate-[zoomIn_0.3s_ease]"
                        style={{
                            animationName: 'zoomIn',
                            animationDuration: '0.3s',
                            animationTimingFunction: 'ease',
                        }}
                    >
                        <span className="text-[#1976d2] font-bold">{peerStates[msg.peer]?.profile?.name || msg.peer.slice(0, 8)}</span>
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
                <span className="text-[#205b78] font-bold pr-1">me:</span>
                <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && chatInput.trim()) {
                            sendChat(chatInput)
                            setChatMessages(msgs => [...msgs, { peer: 'me', message: chatInput }])
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