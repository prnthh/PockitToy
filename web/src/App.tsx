import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import MP from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'

function App() {
  return (
    <>

      <AudioProvider>
        <MP roomId='my-room-id' />
      </AudioProvider>
    </>
  )
}

export default App
