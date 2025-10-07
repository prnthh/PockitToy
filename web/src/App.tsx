import './App.css'
import PockitToy from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'
import SaveBlobProvider from './shared/SaveBlobProvider'

function App() {
  return (
    <>
      <AudioProvider>
        <SaveBlobProvider>
          <PockitToy roomId='my-room-id' />
        </SaveBlobProvider>
      </AudioProvider>
    </>
  )
}

export default App
