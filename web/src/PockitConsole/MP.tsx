"use client";

import { joinRoom, type DataPayload } from 'trystero'
import { useEffect, useState, createContext, useMemo, useRef, type ReactNode } from 'react'
import PeerList from './PeerList'
import ProfilePage from './ProfilePage'
import ChatBox from './ChatBox'
import { useAudio } from '@/shared/AudioProvider'
import { useSaveBlob } from '@/shared/SaveBlobProvider'

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

  const { getBlob, isLoaded, addToAddressBook } = useSaveBlob();
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

  const handlePeerJoin = (peer: string) => {
    sendPlayerState(myStateRef.current, peer)
  }

  const handlePeerLeave = (peer: string) => {
    setPeerStates(states => {
      const newStates = { ...states }
      delete newStates[peer]
      return newStates
    })
  }

  const handlePeerState = (state: any, peer: string) => {
    if (state && typeof state.profile === 'object') {

      // todo if a peer state has a wallet address and is signed, verify it or drop it
      // if not signed, allow only name and avatar updates
      // if signed and verified, allow full profile updates

      console.log('Peer state updated:', peer, state);
      setPeerStates(states => {
        const peerState = {
          ...states[peer], ...state,
        };

        return {
          ...states,
          [peer]: peerState
        }
      })
    }
  }

  // Separate effect to handle address book updates when isLoaded changes
  useEffect(() => {
    if (!isLoaded) return;

    // Update address book for all peers with wallet addresses
    Object.entries(peerStates).forEach(([, peerState]) => {
      if (peerState.profile?.walletAddress) {
        addToAddressBook(peerState.profile.walletAddress, peerState.profile.name);
      }
    });
  }, [isLoaded, peerStates, addToAddressBook]);

  const handleChatMessage = (data: DataPayload, peer: string) => {
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
  }

  // Setup Trystero event listeners for peer join/leave and state updates
  useEffect(() => {
    room.onPeerJoin(handlePeerJoin)
    room.onPeerLeave(handlePeerLeave)
    getPeerStates(handlePeerState)
    getChat(handleChatMessage)
  }, [room, sendPlayerState, getPeerStates])

  useEffect(() => {
    getBlob('profile').then(async (blob) => {
      if (blob) {
        try {
          const text = await blob.text();
          const decodedProfile = JSON.parse(text);

          console.log('Loaded profile:', decodedProfile);

          setMyState(state => ({
            ...state,
            profile: {
              ...state.profile,
              ...decodedProfile
            }
          }));
        } catch (error) {
          console.error('Error decoding profile blob:', error);
        }
      }
    });
  }, [getBlob, setMyState]);

  // Listen for local position updates from parent
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const pos = e.detail as [number, number, number]
      setMyState(state => ({ ...state, position: pos }))
      sendPlayerState({ ...myState, position: pos })
    }
    window.addEventListener('mp-pos', handler as EventListener)
    return () => window.removeEventListener('mp-pos', handler as EventListener)
  }, [])

  // Listen for room events from parent, room is stateless
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      sendChat(`/event ${JSON.stringify(e.detail)}`)
    }
    window.addEventListener('mp-trigger', handler as EventListener)
    return () => window.removeEventListener('mp-trigger', handler as EventListener)
  }, [])

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
        className={`${themes[currentTheme]} w-full h-full flex flex-row items-center rounded-[2.2rem] text-black p-4 font-sans shadow-[inset_-8px_8px_6px_-8px_#ffffff,inset_8px_-8px_6px_-8px_#000000]`}
        style={{
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex flex-col items-center justify-end min-w-[80px] text-white pr-2">
          {/* Pager nav buttons, simplified */}
          <div className="flex flex-col gap-2 mt-1">
            {Object.keys(pages).filter((key) => key !== 'config').map((page) => (
              <div
                key={page}
                className={`${page === currentUIPage ? 'bg-[#1976d2]' : 'bg-gradient-to-br from-[#1976d2] to-[#8cf]'} hover:scale-102 active:scale-95 transition-all h-5 px-1 cursor-pointer rounded-full border shadow flex items-center justify-center font-bold text-[13px]`}
                style={{
                  boxShadow: '0 1px 4px 0 #8cf8',
                }}
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
          {/* Pager logo, simplified */}
          <div className="flex flex-col items-center cursor-pointer select-none text-[12px] font-bold mt-3 tracking-widest text-center" style={{ textShadow: '0 1px 4px #fff8' }}>
            <div
              onClick={() => {
                playSound('/sound/click.mp3')
                setCurrentTheme(Object.keys(themes)[Math.floor(Math.random() * Object.keys(themes).length)] as keyof typeof themes)
                setCurrentUIPage('config')
              }}
              className="text-shadow-[-1px_1px_#ffffffcc,_-1px_-1px_#000000cc] text-black leading-[16px] flex items-center flex-col" >
              POCKIT
            </div>
            <img src="/ui/speaker.png" className="w-10 h-10 mt-1 rounded-full" />
          </div>
        </div>
        {/* Pager screen with glass effect, simplified */}
        <div
          className="rounded-2xl border h-full flex-1 flex relative overflow-hidden"
          style={{
            background: currentTheme == 'metal' ? '#b2d8b2' : 'linear-gradient(rgba(190, 190, 190, 1), rgba(182, 182, 182, 1))',
            boxShadow: 'inset 0 0 16px 2px #5f5f5fff, rgb(91, 91, 91) -1px 1px 1px inset, rgb(5, 5, 5) -1px 1px 3px inset',
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


// server side

// import {joinRoom} from 'trystero'
// import {RTCPeerConnection} from 'node-datachannel/polyfill'

// const room = joinRoom(
//   {appId: 'your-app-id', rtcPolyfill: RTCPeerConnection},
//   'your-room-name'
// )