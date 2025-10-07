import './App.css'
import PockitToy from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'
import SaveBlobProvider from './shared/SaveBlobProvider'

function App() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      <AudioProvider>
        <SaveBlobProvider>
          <PockitToy roomId='my-room-id' />
        </SaveBlobProvider>
      </AudioProvider>
    </>
  )
}

export default App
