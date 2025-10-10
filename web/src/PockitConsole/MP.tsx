"use client";

import { joinRoom, type DataPayload } from 'trystero'
import { useEffect, useState, createContext, useMemo, useRef, type ReactNode } from 'react'
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

  const [connectionKey, setConnectionKey] = useState(Math.random())
  const room = useMemo(() => joinRoom({ appId, password: undefined }, roomId), [appId, roomId, connectionKey])

  useEffect(() => {
    const heartBeat = () => {
      try {
        console.log("heartbeat!", room.getPeers())
      } catch (error) {
        console.error('Error fetching peers:', error)
        setConnectionKey(Math.random()) // Reset connection
      }
    }
    heartBeat();

    const heartBeater = setInterval(heartBeat, 10000)
    return () => clearInterval(heartBeater)
  }, [room])

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
    console.log('Peer joined:', peer)
    sendPlayerState(myStateRef.current, peer)
  }

  const handlePeerLeave = (peer: string) => {
    let peerName = peer.slice(0, 8);
    setPeerStates(states => {
      const peerState = states[peer];
      if (peerState && peerState.profile?.name)
        peerName = peerState.profile.name;
      const newStates = { ...states }
      delete newStates[peer]
      return newStates
    })

    setConsoleMessages(msgs => [...msgs, {
      peer: 'system',
      message: <div className='inline'><span className="font-bold">
        {peerName}</span> left</div>
    }])

  }

  const handlePeerState = (state: any, peer: string) => {
    console.log('Received state from', peer, state)
    setConsoleMessages(msgs => [...msgs, { peer: 'system', message: <div className='inline'><span className="font-bold">{state.profile.name || peer.slice(0, 8)}</span> connected</div> }])

    if (
      state &&
      // Array.isArray(state.position) &&
      // state.position.length === 3 &&
      // state.position.every((n: any) => typeof n === 'number') &&
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

    // setConsoleMessages([
    //   { peer: 'system', message: <div>Connected to pockit.world: {roomId} ❣️</div> }
    // ])
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
        className={`w-full h-full flex flex-row items-center rounded-[2.2rem] text-black bg-gradient-to-br from-[#2229] to-[#2226] p-4 font-sans shadow-[inset_-8px_8px_6px_-8px_#ffffff,inset_8px_-8px_6px_-8px_#000000]`}
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
          <div className="flex flex-col items-center cursor-pointer select-none text-[12px] font-bold mt-4 tracking-widest text-center" style={{ textShadow: '0 1px 4px #fff8' }}>
            <div
              onClick={() => { playSound('/sound/click.mp3') }}
              className="text-shadow-[-1px_1px_#ffffffcc,_-1px_-1px_#000000cc] text-transparent font-black leading-[12px]" >
              POCKIT<br /> NAVI
            </div>
            <img src="/ui/speaker.png" className="w-10 h-10 mt-1 rounded-full" />
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


// server side

// import {joinRoom} from 'trystero'
// import {RTCPeerConnection} from 'node-datachannel/polyfill'

// const room = joinRoom(
//   {appId: 'your-app-id', rtcPolyfill: RTCPeerConnection},
//   'your-room-name'
// )