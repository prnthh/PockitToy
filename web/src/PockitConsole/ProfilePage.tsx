import { useSaveBlob } from "@/shared/SaveBlobProvider";
import ToyWallet from "./ToyWalletProvider";

export default function ProfilePage({ myState, setMyState, sendPlayerState }: {
    myState: { position: [number, number, number], profile: { [key: string]: any } },
    setMyState: React.Dispatch<React.SetStateAction<{ position: [number, number, number], profile: { [key: string]: any } }>>,
    sendPlayerState: (state: { position: [number, number, number], profile: { [key: string]: any } }) => void
}) {

    const { saveBlob } = useSaveBlob();

    const updateProfile = (key: string, value: any) => {
        const newProfile = {
            ...myState.profile,
            [key]: value
        }

        setMyState(state => {
            const newState = {
                ...state,
                profile: newProfile
            }
            sendPlayerState(newState)
            return newState
        });

        // Save profile to blob storage
        const profileData = new Blob([JSON.stringify(newProfile)], { type: 'application/json' });
        saveBlob('profile', profileData);
        console.log('Saved profile data:', newProfile);
    }

    return (
        <div className="h-full w-full overflow-y-auto noscrollbar p-2">
            <Profile updateProfile={updateProfile} state={myState} />
            <div className="flex justify-center gap-x-1">
                {(['oni', 'milady']).map((avatar) => (
                    <button
                        key={avatar}
                        onClick={() => {
                            setMyState(state => {
                                const newState = {
                                    ...state,
                                    profile: {
                                        ...state.profile,
                                        avatar: avatar
                                    }
                                }
                                sendPlayerState(newState)
                                return newState
                            })
                        }}
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
            <input
                value={JSON.stringify(myState.profile)}
                onChange={e => {
                    const val = e.target.value;
                    try {
                        const obj = JSON.parse(val);
                        setMyState(state => {
                            const newState = {
                                ...state,
                                profile: {
                                    ...state.profile,
                                    ...obj
                                }
                            }
                            sendPlayerState(newState)
                            return newState
                        })
                    } catch (err) {
                        // Invalid JSON, ignore
                    }
                }} className="w-full p-2 rounded border-none bg-[#333] text-white text-[10px] font-mono mb-2"
            />
        </div>
    );
}

const Profile = ({ state, updateProfile }: {
    state: { position: [number, number, number], profile: { [key: string]: any } },
    updateProfile?: (key: string, value: any) => void
}) => {
    return <div className="w-full px-2 text-black gap-y-1 flex flex-col">
        <div className="flex justify-between items-end w-full">

            <input
                type="text"
                value={state.profile.name || ''}
                readOnly={!updateProfile}
                onChange={e => {
                    const name = e.target.value;
                    updateProfile?.('name', name);
                }}
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
            <div className="py-2">no achievements yet. <br />keep clicking!</div>
        </div>
    </div>
}

// favorite nfts section, json list of collection address and token id, check if owned by user