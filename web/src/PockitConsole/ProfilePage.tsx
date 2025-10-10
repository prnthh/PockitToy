import { useSaveBlob } from "@/shared/SaveBlobProvider";
import { ToyWallet, useToyWallet } from "@/PockitWallet/ToyWalletProvider";
import { useEffect, useState } from "react";

export default function ProfilePage({ myState, setMyState, sendPlayerState }: {
    myState: { position: [number, number, number], profile: { [key: string]: any } },
    setMyState: React.Dispatch<React.SetStateAction<{ position: [number, number, number], profile: { [key: string]: any } }>>,
    sendPlayerState: (state: { position: [number, number, number], profile: { [key: string]: any } }) => void
}) {
    const { useData } = useSaveBlob();
    const [savedProfile, setSavedProfile] = useData('profile', {});
    const [profile, setProfile] = useState(myState.profile);
    const { walletState } = useToyWallet();

    // Load saved profile on mount
    useEffect(() => {
        if (Object.keys(savedProfile).length > 0) {
            setProfile(savedProfile);
        }
    }, [savedProfile]);

    // Sync profile changes
    useEffect(() => {
        setMyState(state => ({ ...state, profile }));
        sendPlayerState({ ...myState, profile });
        setSavedProfile(profile);
    }, [profile]);

    // Handle wallet address
    useEffect(() => {
        if (walletState.address && walletState.address !== profile.walletAddress) {
            setProfile(prev => ({ ...prev, walletAddress: walletState.address }));
        }
    }, [walletState.address, profile.walletAddress]);

    const updateProfile = (key: string, value: any) => {
        setProfile(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="h-full w-full overflow-y-auto noscrollbar p-2">
            <Profile profile={profile} updateProfile={updateProfile} />
            <input
                value={JSON.stringify(profile)}
                onChange={(e) => {
                    try {
                        const obj = JSON.parse(e.target.value);
                        setProfile(obj);
                    } catch {
                        // Invalid JSON, ignore
                    }
                }}
                className="w-full p-2 rounded border-none bg-[#333] text-white text-[10px] font-mono mb-2"
            />
            <div className="text-xs" onClick={() => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then((registration) => {
                        registration.update();
                    });
                }
            }}>
                build version: cool-rest
            </div>
        </div>
    );
}

const Profile = ({ profile, updateProfile }: {
    profile: { [key: string]: any },
    updateProfile?: (key: string, value: any) => void
}) => {
    return <div className="w-full px-2 text-black gap-y-1 flex flex-col">
        <div className="flex justify-between items-end w-full">

            <input
                type="text"
                value={profile.name || ''}
                onChange={e => updateProfile?.('name', e.target.value)}
                placeholder='nickname'
                className="font-mono text-xl p-1 rounded border-none bg-transparent text-black outline-none w-[70%]"
            />
            <div className="border bg-white/30 w-16 h-16"><img /></div>
        </div>

        {/* Wallet Pill */}
        <div className="flex justify-center my-2">
            <ToyWallet />
        </div>

        <div className="font-mono text-sm border my-1">This user likes cheese.</div>
        <div className="font-mono text-sm border my-1 text-center">
            <span className="flex justify-center w-full border-b">Achievements</span>
            {/* todo: set a pin, meet pockit ceo, meet a friend, send a message */}
            <div className="py-2">no achievements yet. <br />keep clicking!</div>
        </div>

        <div className="flex justify-center gap-x-1">
            {(['oni', 'milady']).map((avatar) => (
                <button
                    key={avatar}
                    onClick={() => updateProfile?.('avatar', avatar)}
                    className="text-[12px] px-3 py-1 rounded bg-gradient-to-r from-[#1976d2] to-[#8cf] font-bold border shadow mb-2 mt-1 cursor-pointer"
                    style={{
                        boxShadow: '0 2px 8px 0 #8cf8',
                        textShadow: '0 1px 2px #2228',
                    }}
                >
                    {avatar}
                </button>
            ))}
        </div>
    </div>
}

// favorite nfts section, json list of collection address and token id, check if owned by user