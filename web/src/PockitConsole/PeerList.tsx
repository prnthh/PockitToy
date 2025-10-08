import { useContext, useState } from 'react'
import { MPContext } from './MP';

const buttonStyle = `bg-black/20 text-[#8cf] rounded px-1.5 py-1.5 text-left cursor-pointer`

export default function PeerList({ sendChat }: {
    sendChat: (msg: string, peer?: string) => void
}) {
    const { peerStates, room } = useContext(MPContext);
    const [peerOptions, setPeerOptions] = useState<string | null>(null)
    const [showDM, setShowDM] = useState<string | null>(null)
    const [dmInput, setDmInput] = useState('')
    return (
        <div className="w-full p-2 h-full overflow-y-auto noscrollbar">
            <div className="font-bold mb-1">{Object.keys(peerStates).length} Peers</div>
            <div className="w-full m-0 p-0">
                {Object.entries(peerStates).map(([peerId, state]) => (
                    <div key={peerId} className="flex flex-col text-[12px] mb-0.5 relative cursor-pointer"
                        onClick={e => {
                            e.stopPropagation();
                            setPeerOptions(peerOptions === peerId ? null : peerId);
                        }}
                        onPointerLeave={() => peerOptions === peerId && setPeerOptions(null)}
                    >
                        <div className='flex justify-between items-center bg-black/15 rounded p-1 px-2 hover:bg-black/20 hover:scale-101 transition-all'

                        >
                            {state.profile.name || peerId.slice(0, 8)}
                            {/* Example: show position and profile */}
                            {/* <span className="ml-1 text-[#aaa]">({state.position.join(', ')})</span> */}
                        </div>
                        {peerOptions === peerId && (
                            <div className=" bg-black/25 border rounded mt-1 min-w-[80px] flex flex-col"
                            >
                                <div className='flex gap-x-1 p-1'>

                                    <button
                                        className={buttonStyle}
                                        onClick={() => {
                                            setShowDM(peerId);
                                            setPeerOptions(null);
                                        }}
                                    >DM</button>
                                    <button
                                        className={buttonStyle}
                                        onClick={() => {
                                            try {
                                                const peerConn = room.getPeers()[peerId];
                                                if (peerConn) peerConn.close();
                                            } catch (err) { }
                                            setPeerOptions(null);
                                        }}
                                    >Block</button>
                                </div>
                                <div>
                                    {state.profile && <textarea className="text-white p-1" value={JSON.stringify(state.profile)} />}

                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {showDM && (
                    <div className="fixed left-0 top-0 w-full h-full bg-black/50 z-[2000] flex items-center justify-center rounded-4xl" onClick={() => setShowDM(null)}>
                        <div className="bg-[#222] p-5 rounded-xl min-w-[300px]" onClick={e => e.stopPropagation()}>
                            <div className="mb-2.5 text-[#8cf]">DM to {showDM.slice(0, 8)}</div>
                            <input
                                type="text"
                                autoFocus
                                className="w-full p-2 rounded border-none bg-[#333] text-white mb-2.5"
                                value={dmInput}
                                onChange={e => setDmInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && dmInput.trim()) {
                                        sendChat(dmInput, showDM);
                                        setShowDM(null);
                                        setDmInput('');
                                    }
                                }}
                                placeholder="Type a DM..."
                            />
                            <button className="bg-[#8cf] text-[#222] border-none rounded px-3 py-1 cursor-pointer" onClick={() => {
                                if (dmInput.trim()) {
                                    sendChat(dmInput, showDM);
                                    setShowDM(null);
                                    setDmInput('');
                                }
                            }}>Send</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
