import { useContext, useState, useMemo } from 'react'
import { MPContext } from './MP';
import { useSaveBlob } from '@/shared/SaveBlobProvider';

const buttonStyle = `bg-black/20 text-[#8cf] rounded px-1.5 py-1.5 text-left cursor-pointer`

type Contact = {
    id: string
    name: string
    isOnline: boolean
    isFriend: boolean
    peerId?: string
    walletAddress?: string
    profile?: any
}

export default function PeerList({ sendChat }: { sendChat: (msg: string, peer?: string) => void }) {
    const { peerStates, room } = useContext(MPContext);
    const { useData, isLoaded } = useSaveBlob();
    const [addressBook, setAddressBook] = useData('addressBook', {} as Record<string, { name: string, addedAt: string, publicKey?: string }>);
    const [selected, setSelected] = useState<string | null>(null);
    const [dmTarget, setDmTarget] = useState<string | null>(null);
    const [dmInput, setDmInput] = useState('');

    const deleteContact = async (address: string) => {
        try {
            setAddressBook(prev => {
                const updated = { ...prev };
                delete updated[address];
                return updated;
            });
            setSelected(null);
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };

    const sendDM = () => {
        if (dmInput.trim() && dmTarget) {
            sendChat(dmInput, dmTarget);
            setDmTarget(null);
            setDmInput('');
        }
    };

    // Build unified contact list
    const contacts = useMemo(() => {
        const result: Contact[] = [];
        const addressToPeerId = new Map<string, string>();

        // Map wallet addresses to peer IDs
        Object.entries(peerStates).forEach(([peerId, state]) => {
            if (state.profile?.walletAddress) {
                addressToPeerId.set(state.profile.walletAddress, peerId);
            }
        });

        // Online friends first
        Object.entries(addressBook).forEach(([address, data]) => {
            const peerId = addressToPeerId.get(address);
            if (peerId) {
                result.push({
                    id: address,
                    name: data.name,
                    isOnline: true,
                    isFriend: true,
                    peerId,
                    walletAddress: address,
                    profile: peerStates[peerId]?.profile
                });
            }
        });

        // Online non-friends
        Object.entries(peerStates).forEach(([peerId, state]) => {
            const address = state.profile?.walletAddress;
            if (!address || !addressBook[address]) {
                result.push({
                    id: peerId,
                    name: state?.profile?.name || peerId.slice(0, 8),
                    isOnline: true,
                    isFriend: false,
                    peerId,
                    walletAddress: address,
                    profile: state.profile
                });
            }
        });

        // Offline friends last
        Object.entries(addressBook).forEach(([address, data]) => {
            if (!addressToPeerId.has(address)) {
                result.push({
                    id: address,
                    name: data.name,
                    isOnline: false,
                    isFriend: true,
                    walletAddress: address,
                    profile: {
                        name: data.name,
                        walletAddress: address,
                        publicKey: data.publicKey,
                        addedAt: data.addedAt
                    }
                });
            }
        });

        return result;
    }, [peerStates, addressBook]);

    const onlineCount = contacts.filter(c => c.isOnline).length;
    const friendsCount = contacts.filter(c => c.isFriend).length;

    return (
        <div className="w-full p-2 h-full overflow-y-auto noscrollbar">
            <div className="font-bold mb-1">Contacts ({onlineCount} online, {friendsCount} friends)</div>

            {contacts.map(contact => (
                <div key={contact.id} className="text-[12px] mb-0.5 cursor-pointer"
                    onClick={() => setSelected(selected === contact.id ? null : contact.id)}
                    onPointerLeave={() => selected === contact.id && setSelected(null)}>

                    <div className={`flex justify-between items-center rounded p-1 px-2 hover:bg-black/20 transition-all ${contact.isFriend && contact.isOnline ? 'bg-green-500/25' :
                        contact.isOnline ? 'bg-blue-500/15' : 'bg-gray-500/10'
                        }`}>
                        <span className="font-mono">{contact.name}</span>
                        <div className="flex items-center gap-1">
                            {contact.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                            <span className="text-black text-[10px]">
                                {contact.walletAddress ?
                                    `${contact.walletAddress.slice(0, 6)}...${contact.walletAddress.slice(-4)}` :
                                    contact.peerId?.slice(0, 8)
                                }
                            </span>
                        </div>
                    </div>

                    {selected === contact.id && (
                        <div className="bg-black/25 border rounded mt-1 p-1 flex gap-1">
                            {contact.isOnline && (
                                <button className={buttonStyle} onClick={(e) => {
                                    e.stopPropagation();
                                    setDmTarget(contact.peerId || contact.id);
                                }}>DM</button>
                            )}
                            {!contact.isFriend && contact.peerId && (
                                <button className={buttonStyle} onClick={(e) => {
                                    e.stopPropagation();
                                    try {
                                        const peers = room.getPeers();
                                        if (contact.peerId && peers[contact.peerId]) {
                                            peers[contact.peerId].close();
                                        }
                                    } catch (err) { }
                                }}>Block</button>
                            )}
                            {contact.isFriend && (
                                <button className={`${buttonStyle} bg-red-500/30 text-red-300`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteContact(contact.walletAddress!);
                                    }}>Delete</button>
                            )}

                            <textarea
                                readOnly
                                className="flex-1 bg-black/10 text-white text-[10px] font-mono p-1 rounded border border-black/30 resize-none"
                                value={contact.profile ? JSON.stringify(contact.profile, null, 2) : 'No profile data'}
                            />

                        </div>
                    )}
                </div>
            ))}

            {contacts.length === 0 && isLoaded && (
                <div className="text-[11px] text-black italic text-center py-2">
                    No contacts yet. Connect with peers to build your network!
                </div>
            )}

            {dmTarget && (
                <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center"
                    onClick={() => setDmTarget(null)}>
                    <div className="bg-[#222] p-5 rounded-xl min-w-[300px]" onClick={e => e.stopPropagation()}>
                        <div className="mb-2.5 text-[#8cf]">DM to {contacts.find(c => c.peerId === dmTarget || c.id === dmTarget)?.name}</div>
                        <input
                            type="text"
                            autoFocus
                            className="w-full p-2 rounded bg-[#333] text-white mb-2.5"
                            value={dmInput}
                            onChange={e => setDmInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendDM()}
                            placeholder="Type a DM..."
                        />
                        <button className="bg-[#8cf] text-[#222] rounded px-3 py-1" onClick={sendDM}>
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}