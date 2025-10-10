import { useSaveBlob } from "@/shared/SaveBlobProvider";
import { ToyWallet, useToyWallet } from "@/PockitWallet/ToyWalletProvider";
import { useEffect, useCallback } from "react";

export default function ProfilePage({ myState, setMyState, sendPlayerState }: {
    myState: { position: [number, number, number], profile: { [key: string]: any } },
    setMyState: React.Dispatch<React.SetStateAction<{ position: [number, number, number], profile: { [key: string]: any } }>>,
    sendPlayerState: (state: { position: [number, number, number], profile: { [key: string]: any } }) => void
}) {
    const updateProfile = useCallback((key: string, value: any) => {
        setMyState(state => {
            const newProfile = { ...state.profile, [key]: value };
            const newState = { ...state, profile: newProfile };
            sendPlayerState(newState);
            return newState;
        });
    }, [setMyState, sendPlayerState]);

    const handleJsonInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const obj = JSON.parse(e.target.value);
            const newProfile = { ...myState.profile, ...obj };
            setMyState(state => ({ ...state, profile: newProfile }));
            sendPlayerState({ ...myState, profile: newProfile });
        } catch {
            // Invalid JSON, ignore
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto noscrollbar p-2">
            <Profile updateProfile={updateProfile} state={myState} />
            <input
                value={JSON.stringify(myState.profile)}
                onChange={handleJsonInputChange}
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

const Profile = ({ state, updateProfile }: {
    state: { position: [number, number, number], profile: { [key: string]: any } },
    updateProfile?: (key: string, value: any) => void
}) => {
    const wallet = useToyWallet();
    const { walletState } = wallet;
    const { isLoaded } = useSaveBlob();

    useEffect(() => {
        if (walletState.address && isLoaded && updateProfile) {
            updateProfile('walletAddress', walletState.address);
        }
    }, [walletState.address, isLoaded, updateProfile]);

    return <div className="w-full px-2 text-black gap-y-1 flex flex-col">
        <div className="flex justify-between items-end w-full">

            <input
                type="text"
                value={state.profile.name || ''}
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