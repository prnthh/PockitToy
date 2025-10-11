"use client";

import { joinRoom, type DataPayload, selfId } from 'trystero'
import { useEffect, useState, createContext, useMemo, useRef, useCallback, type ReactNode } from 'react'
import PeerList from './PeerList'
import ProfilePage from './ProfilePage'
import ChatBox from './ChatBox'
import { useAudio } from '@/shared/AudioProvider'
import { useSaveBlob } from '@/shared/SaveBlobProvider'
import { useToyWallet } from '@/PockitWallet/ToyWalletProvider';

const themes = {
  metal: "bg-gradient-to-br from-[#2229] to-[#2226]", // original gray
  purplePlastic: "bg-gradient-to-br from-[#a070d1] to-[#7040a0]",// Game Boy Color purple
  bluePlastic: "bg-gradient-to-br from-[#6fb4ff] to-[#00f0ff]",  // cyberpunk neon cyan -> violet
  redPlastic: "bg-gradient-to-br from-[#d93a3a] to-[#ff9b9b]",   // warm Game Boy Color red/pink
}

export type PeerState = {
  position: [number, number, number],
  profile: { [key: string]: any },
  latestMessage?: { message: string, timestamp: number }
}
export const MPContext = createContext<{
  room: any,
  peerStates: Record<string, PeerState>
  myState?: PeerState & {}
}>({
  room: null,
  peerStates: {}
})

export default function MP({ appId = 'pockit.world', roomId, children }: { appId?: string, roomId: string, children?: React.ReactNode }) {
  // Suppress 'User-Initiated Abort' RTC errors in the console
  useEffect(() => {
    const origConsoleError = console.error
    console.error = function (...args) {
      if (
        args[0]?.error?.name === 'OperationError' &&
        args[0]?.error?.message?.includes('User-Initiated Abort')
      ) {
        // Suppress this error
        return
      }
      origConsoleError.apply(console, args)
    }
    return () => { console.error = origConsoleError }
  }, [])

  const { isLoaded, useData } = useSaveBlob();
  const [, setAddressBook] = useData('addressBook', {} as Record<string, { name: string, addedAt: string, publicKey?: string }>);

  // Load profile using the new reactive data API
  const [profile] = useData('profile', {});

  // Initialize myState with saved profile on mount
  useEffect(() => {
    if (Object.keys(profile).length > 0) {
      setMyState(state => ({
        ...state,
        profile: profile
      }));
    }
  }, [isLoaded]); // Only run when SaveBlob is loaded

  const [connectionKey, setConnectionKey] = useState(Math.random())
  const room = useMemo(() => joinRoom({ appId, password: undefined }, roomId), [appId, roomId, connectionKey])

  useEffect(() => {
    let interval: number | null = null;

    const heartbeat = () => {
      try {
        room.getPeers();
      } catch (error) {
        console.error('Connection error:', error);
        setConnectionKey(Math.random());
      }
    };

    const start = () => {
      if (interval) clearInterval(interval);
      heartbeat();
      interval = setInterval(heartbeat, 10000);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => document.hidden ? stop() : start();

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', start);
    window.addEventListener('blur', stop);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', start);
      window.removeEventListener('blur', stop);
    };
  }, [room]);

  const { handleSign, handleVerify, walletState } = useToyWallet();

  // Peer states
  const [sendPlayerState, getPeerStates] = room.makeAction('peerState')
  const [peerStates, setPeerStates] = useState<Record<string, PeerState>>({})
  const [myState, setMyState] = useState<{ position: [number, number, number], profile: { [key: string]: any } }>({ position: [0, 0, 0], profile: {} })
  const myStateRef = useRef(myState)
  useEffect(() => {
    // Keep ref in sync with state
    myStateRef.current = myState
  }, [myState])

  // Chat state
  const [sendChat, getChat] = room.makeAction('chat')
  const [chatInput, setChatInput] = useState('')
  const [consoleMessages, setConsoleMessages] = useState<Array<{ peer: string, message: string | ReactNode }>>([])
  const { playSound } = useAudio();

  const trySignState = useCallback(async (state: any) => {
    const stateToSend = { ...state, profile: { ...(state?.profile || {}) } };
    stateToSend.profile.peerId = selfId;

    try {
      const result = await handleSign(JSON.stringify(stateToSend.profile));
      if (result && typeof result.s === 'string') {
        const { m, s, f } = result;
        console.log('Profile signed successfully', { m: JSON.parse(m), s, f });
        stateToSend.signature = s;
      }
    } catch (error) {
      // console.log('Failed to sign profile:', error);
    }

    return stateToSend;
  }, [handleSign]);


  useEffect(() => {
    if (walletState.unlocked) {
      const stateToSend = { ...myStateRef.current }
      stateToSend.profile.peerId = selfId

      trySignState(stateToSend).then((signedState) => {
        sendPlayerState(signedState);
      })
    }
  }, [walletState.unlocked])

  const handlePeerJoin = useCallback((peer: string) => {
    const stateToSend = { ...myStateRef.current }
    stateToSend.profile.peerId = selfId

    trySignState(stateToSend).then((signedState) => {
      sendPlayerState(signedState, peer);
    })

  }, [sendPlayerState])

  const handlePeerLeave = useCallback((peer: string) => {
    setPeerStates(states => {
      const newStates = { ...states }
      delete newStates[peer]
      return newStates
    })
  }, [])

  const handlePeerState = useCallback((state: any, peer: string) => {
    if (state && typeof state.profile === 'object') {
      if (state.signature || state.profile.walletAddress) {
        // TODO verify signature
        handleVerify({
          m: JSON.stringify(state.profile),
          s: state.signature,
          f: state.profile.walletAddress
        }).then(() => {
          // console.log('Signature valid:', isValid);
        }).catch(() => {
          delete state.profile.walletAddress;
          delete state.signature;
        });
      }
      console.log('Got peer state:', peer, state.signature ? '(signed)' : '(unsigned)', state);

      setPeerStates(peerStates => {
        return {
          ...peerStates,
          [peer]: {
            ...peerStates[peer],
            ...state,
          }
        }
      })
    }
  }, [])

  // Handle address book updates when new peers join with wallet addresses
  useEffect(() => {
    if (!isLoaded) return;

    Object.values(peerStates).forEach((peerState) => {
      if (peerState.profile?.walletAddress && peerState.profile?.name) {
        setAddressBook(prev => ({
          ...prev,
          [peerState.profile.walletAddress]: {
            name: peerState.profile.name,
            addedAt: new Date().toISOString(),
            publicKey: peerState.profile.publicKey
          }
        }));
      }
    });
  }, [isLoaded, peerStates, setAddressBook]);

  const handleChatMessage = useCallback((data: DataPayload, peer: string) => {
    if (typeof data === 'string') {
      if (data.startsWith('/')) {
        const command = data.slice(1).trim().split(' ')[0]
        if (command === 'event') {
          if (peer == roomId) return; // Ignore events from the same room
          const eventData = data.slice(7).trim()
          // Handle room events
          window.dispatchEvent(new CustomEvent('mp-event', { detail: JSON.parse(eventData) }))
          return
        }
      }
      setConsoleMessages(msgs => [...msgs, { peer, message: data }])
      // Update peerStates with latest message and timestamp
      setPeerStates(states => {
        if (!peer) return states;
        const now = Date.now();
        return {
          ...states,
          [peer]: {
            ...states[peer],
            latestMessage: { message: data, timestamp: now }
          }
        }
      })
    }
  }, [roomId])

  // Setup Trystero event listeners for peer join/leave and state updates
  useEffect(() => {
    room.onPeerJoin(handlePeerJoin)
    room.onPeerLeave(handlePeerLeave)
    getPeerStates(handlePeerState)
    getChat(handleChatMessage)
  }, [room, getPeerStates, getChat, handlePeerJoin, handlePeerLeave, handlePeerState, handleChatMessage])

  // Listen for local position updates from parent
  // useEffect(() => {
  //   const handler = (e: CustomEvent) => {
  //     const pos = e.detail as [number, number, number]
  //     setMyState(state => ({ ...state, position: pos }))
  //     // Use myStateRef to get current state without stale closure
  //     // sendPlayerState({ ...myStateRef.current, position: pos })
  //   }
  //   window.addEventListener('mp-pos', handler as EventListener)
  //   return () => window.removeEventListener('mp-pos', handler as EventListener)
  // }, [sendPlayerState])

  // Listen for room events from parent, room is stateless
  // useEffect(() => {
  //   const handler = (e: CustomEvent) => {
  //     sendChat(`/event ${JSON.stringify(e.detail)}`)
  //   }
  //   window.addEventListener('mp-trigger', handler as EventListener)
  //   return () => window.removeEventListener('mp-trigger', handler as EventListener)
  // }, [sendChat])

  const pages = useMemo(() => ({
    profile: <ProfilePage
      myState={myState}
      setMyState={setMyState}
      sendPlayerState={sendPlayerState}
    />,
    console: <ChatBox
      chatInput={chatInput}
      setChatInput={setChatInput}
      sendChat={sendChat}
      consoleMessages={consoleMessages}
      setConsoleMessages={setConsoleMessages}
    />,
    friends: <PeerList
      sendChat={sendChat}
    />,
    config: <div className='w-full h-full flex items-center justify-center text-black'>current channel / trusted domains / trusted admins</div>
  }), [myState, setMyState, sendPlayerState, chatInput, setChatInput, sendChat, consoleMessages, setConsoleMessages]);

  const [currentUIPage, setCurrentUIPage] = useState<keyof typeof pages>(Object.keys(pages)[0] as keyof typeof pages)
  const [currentTheme, setCurrentTheme] = useState<keyof typeof themes>(Object.keys(themes)[Math.floor(Math.random() * Object.keys(themes).length)] as keyof typeof themes)


  return (
    <MPContext.Provider value={{ room, peerStates, myState }}>
      {children}
      <div
        className={`w-full h-full flex flex-row items-center -[2.2rem] text-black p-3 font-sans `}
      >
        <div className={`absolute top-0 left-0 ${themes[currentTheme]} w-full h-full rounded-[2.2rem] shadow-[inset_-8px_8px_6px_-8px_#ffffff,inset_8px_-8px_6px_-8px_#000000]`}>
          {/* Pager logo, simplified */}
          <div className="absolute bottom-8 left-5 flex flex-col items-center cursor-pointer select-none text-[12px] font-bold mt-3 tracking-widest text-center" style={{ textShadow: '0 1px 4px #fff8' }}>
            <div
              onClick={() => {
                playSound('/sound/click.mp3')
                setCurrentTheme(Object.keys(themes)[Math.floor(Math.random() * Object.keys(themes).length)] as keyof typeof themes)
                setCurrentUIPage('config')
              }}
              className="text-shadow-[-1px_1px_#ffffffcc,_-1px_-1px_#000000cc] text-black leading-[16px] flex items-center flex-col" >
              POCKIT
            </div>
            {/* <img src="/ui/speaker.png" className="w-10 h-10 mt-1 rounded-full" /> */}
          </div>
        </div>
        <div className="z-10 flex flex-col items-center h-full justify-start min-w-[80px] font-mono">
          <WalletLock unlockHint={() => {
            setCurrentUIPage('profile')
          }} />
          {/* Pager nav buttons, simplified */}
          <div className="flex flex-col gap-2 mt-4 mr-3">
            {Object.keys(pages).filter((key) => key !== 'config').map((page) => (
              <div
                key={page}
                className={`${page === currentUIPage ? 'bg-[#ffffffdd]' : 'bg-[#dddddddd]'} hover:scale-102 active:scale-95 transition-all h-5 px-2 cursor-pointer rounded-full shadow active:shadow-sm flex items-center justify-center text-[10px]`}
                onMouseEnter={() => playSound('/sound/click.mp3')}
                onPointerDown={() => playSound('/sound/click2.mp3')}
                onClick={() => {
                  setCurrentUIPage(page as keyof typeof pages)
                }}
              >
                {page}
              </div>
            ))}
          </div>

        </div>
        {/* Pager screen with glass effect, simplified */}
        <div
          className="rounded-2xl h-full flex-1 flex relative overflow-hidden"
          style={{
            background: currentTheme == 'metal' ? '#b2d8b2' : 'linear-gradient(rgba(222, 222, 222, 1), rgba(185, 185, 185, 1))',
            boxShadow: 'inset 0 0 6px 0.5px #414141ff, rgba(255, 255, 255, 0.5) -1px 1px 4px 1px, rgba(0, 0, 0, 0.7) 1px -1px 2px 1px',
          }}
        >
          {pages[currentUIPage]}
        </div>


        {/* Glossy overlays for depth, keep outer shell shine */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-[2.2rem] bg-gradient-to-tr from-white/40 via-white/0 to-white/20 opacity-70mix-blend-screen" />
      </div>
    </MPContext.Provider >
  )
}

const WalletLock = ({ unlockHint }: { unlockHint: () => void }) => {
  const { walletState, lock } = useToyWallet();

  return <div className='flex justify-between w-full'>
    <div className={`${walletState.unlocked ? 'bg-green-500' : 'bg-red-500'} h-[50px] w-[30px] rounded-tl-[22px] rounded flex flex-col items-center relative  shadow-[inset_0px_0px_6px_0px_#000000]`}>
      <div
        onClick={() => {
          if (walletState.unlocked) {
            lock();
          } else {
            // unlock();
            unlockHint();
          }
        }}
        title={walletState.unlocked ? 'Click to lock wallet' : 'Click to unlock wallet'}
        className={`${walletState.unlocked ? 'top-[2px]' : 'top-[calc(100%-32px)]'} 
        text-xs flex items-center justify-center pl-0.5 pt-0.5 
        shadow-[0px_0px_3px_0px_#000000,inset_-8px_8px_6px_-8px_#aaaaaa,inset_8px_-8px_6px_-8px_#888888] 
        absolute bg-white transition-all h-[30px] w-[88%] rounded rounded-tl-[21px]`
        }
      >
        {walletState.unlocked ? `🔓` : `🔒`}
      </div>
    </div>
    <div className='flex flex-col items-start p-2 grow gap-y-2 w-[10px]'>
      <div className='ml-2 w-[8px] h-[8px] bg-green-500 rounded-full        shadow-[0px_0px_3px_0px_#000000,inset_-1px_1px_0.5px_-1px_#ffffff,inset_1px_-1px_0.5px_-1px_#000000] 
'></div>
      <div className='ml-2 w-[8px] h-[8px] bg-amber-500 rounded-full         shadow-[0px_0px_3px_0px_#000000,inset_-1px_1px_0.5px_-1px_#ffffff,inset_1px_-1px_0.5px_-1px_#000000] 
'></div>
    </div>
  </div>
}


// server side

// import {joinRoom} from 'trystero'
// import {RTCPeerConnection} from 'node-datachannel/polyfill'

// const room = joinRoom(
//   {appId: 'your-app-id', rtcPolyfill: RTCPeerConnection},
//   'your-room-name'
// )