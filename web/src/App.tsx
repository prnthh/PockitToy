import './App.css'
import PockitToy from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'

function App() {
  return (
    <>
      <AudioProvider>
        <PockitToy roomId='my-room-id' />
      </AudioProvider>
    </>
  )
}

export default App
