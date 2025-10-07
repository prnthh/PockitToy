"use client";

import { joinRoom } from 'trystero'
import { useEffect, useState, createContext, useMemo } from 'react'
import PeerList from './PeerList'
import ProfilePage from './ProfilePage'
import ChatBox from './ChatBox'
import { useAudio } from '@/shared/AudioProvider'
import { useSaveBlob } from '@/shared/SaveBlobProvider'

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
  const room = joinRoom({ appId, password: undefined }, roomId)
  const [sendPlayerState, getPeerStates] = room.makeAction('peerState')
  const [myState, setMyState] = useState<{ position: [number, number, number], profile: { [key: string]: any } }>({ position: [0, 0, 0], profile: {} })
  const [peerStates, setPeerStates] = useState<Record<string, PeerState>>({})

  // Chat state
  const [sendChat, getChat] = room.makeAction('chat')
  const [chatInput, setChatInput] = useState('')
  const [consoleMessages, setConsoleMessages] = useState<Array<{ peer: string, message: string }>>([])
  const { playSound } = useAudio();

  // Listen for incoming chat messages
  useEffect(() => {
    setConsoleMessages([
      { peer: 'system', message: `Connected to pockit.world: ${roomId}` }
    ]) // Clear chat on room change
    getChat((message, peer) => {
      if (typeof message === 'string') {
        if (message.startsWith('/')) {
          const command = message.slice(1).trim().split(' ')[0]
          if (command === 'event') {
            if (peer == roomId) return; // Ignore events from the same room
            const eventData = message.slice(7).trim()
            // Handle room events
            window.dispatchEvent(new CustomEvent('mp-event', { detail: JSON.parse(eventData) }))
            return
          }
        }
        setConsoleMessages(msgs => [...msgs, { peer, message }])
        // Update peerStates with latest message and timestamp
        setPeerStates(states => {
          if (!peer) return states;
          const now = Date.now();
          return {
            ...states,
            [peer]: {
              ...states[peer],
              latestMessage: { message, timestamp: now }
            }
          }
        })
      }
    })
  }, [])

  const handlePeerJoin = (peer: string) => {
    console.log('Peer joined:', peer, myState)
    sendPlayerState(myState, peer)
    setConsoleMessages(msgs => [...msgs, { peer: 'system', message: `Peer joined: ${peer.slice(0, 8)}` }])
  }
  const handlePeerLeave = (peer: string) => {
    setPeerStates(states => {
      const newStates = { ...states }
      delete newStates[peer]
      return newStates
    })
    setConsoleMessages(msgs => [...msgs, { peer: 'system', message: `Peer left: ${peer.slice(0, 8)}` }])
  }

  const handlePeerState = (state: any, peer: string) => {
    console.log('Received state from', peer, state)
    if (
      state &&
      Array.isArray(state.position) &&
      state.position.length === 3 &&
      state.position.every((n: any) => typeof n === 'number') &&
      typeof state.profile === 'object'
    ) {
      setPeerStates(states => {
        const prev = states[peer] || {};
        return {
          ...states,
          [peer]: {
            ...prev,
            ...state,
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

    // Cleanup: Trystero does not provide off/on removal, but if it did, add here
    // Return cleanup if needed
    // return () => { ... }
  }, [room, sendPlayerState, getPeerStates])

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

  const { getBlob } = useSaveBlob();

  useEffect(() => {
    getBlob('profile').then(async (blob) => {
      if (blob) {
        try {
          const text = await blob.text();
          const decodedProfile = JSON.parse(text);

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


  const pages = useMemo(() => ({
    profile: ProfilePage,
    console: ChatBox,
    friends: PeerList
  }), []);

  const [currentUIPage, setCurrentUIPage] = useState<keyof typeof pages>('console')


  return (
    <MPContext.Provider value={{ room, peerStates, myState }}>
      {children}
      <div
        className="h-[220px] w-[92vw] md:w-[400px] flex flex-row items-center rounded-[2.2rem] text-black bg-gradient-to-br from-[#2229] to-[#2226] p-4 font-sans shadow-[inset_-8px_8px_6px_-8px_#ffffff,inset_8px_-8px_6px_-8px_#000000]"
        style={{
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex flex-col items-center justify-end min-w-[80px] text-white pr-2">
          {/* Pager nav buttons, simplified */}
          <div className="flex flex-col gap-2 mt-1">
            {Object.keys(pages).map((page) => (
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
          <div className="cursor-pointer select-none mt-4 text-[10px] text-[white] font-bold mt-2 tracking-widest text-center" style={{ textShadow: '0 1px 4px #fff8' }}>
            <div
              onClick={() => { playSound('/sound/click.mp3') }}
              className="font-black leading-[10px] bg-white/10 rounded p-1 border border-black" style={{ textShadow: '0 1px 8px #8cf8' }}>
              POCKIT<br /> NAVI
            </div>
          </div>
        </div>
        {/* Pager screen with glass effect, simplified */}
        <div
          className="rounded-2xl border h-full flex-1 flex relative overflow-hidden"
          style={{
            background: currentUIPage == 'profile' ? 'linear-gradient(rgba(190, 190, 190, 1), rgba(182, 182, 182, 1))' : '#b2d8b2',
            boxShadow: 'inset 0 0 16px 2px #5f5f5fff, rgb(91, 91, 91) -1px 1px 1px inset, rgb(5, 5, 5) -1px 1px 3px inset',
          }}
        >
          {currentUIPage === 'console' && <ChatBox
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChat={sendChat}
            consoleMessages={consoleMessages}
            setConsoleMessages={setConsoleMessages}
          />}
          {currentUIPage === 'profile' && <ProfilePage
            myState={myState}
            setMyState={setMyState}
            sendPlayerState={sendPlayerState}
          />}
          {currentUIPage === 'friends' && <PeerList
            sendChat={sendChat}
          />}
        </div>


        {/* Glossy overlays for depth, keep outer shell shine */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-[2.2rem] bg-gradient-to-tr from-white/40 via-white/0 to-white/20 opacity-70mix-blend-screen" />
      </div>
    </MPContext.Provider >
  )
}

// export const useRoom = (roomConfig: BaseRoomConfig, roomId: string) => {
//   const roomRef = useRef(joinRoom(roomConfig, roomId))
//   const lastRoomIdRef = useRef(roomId)

//   useEffect(() => {
//     if (roomId !== lastRoomIdRef.current) {
//       roomRef.current.leave()
//       roomRef.current = joinRoom(roomConfig, roomId)
//       lastRoomIdRef.current = roomId
//     }

//     return () => {
//       roomRef.current.leave()
//     }
//   }, [roomConfig, roomId])

//   return roomRef.current
// }


// server side

// import {joinRoom} from 'trystero'
// import {RTCPeerConnection} from 'node-datachannel/polyfill'

// const room = joinRoom(
//   {appId: 'your-app-id', rtcPolyfill: RTCPeerConnection},
//   'your-room-name'
// )