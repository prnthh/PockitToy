import { useEffect, useState } from 'react';
import './App.css'
import PockitToy from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'
import SaveBlobProvider from './shared/SaveBlobProvider'
import SkyShader from './shared/GLSLCanvas';

function App() {

  return (
    <IframePositionWrapper>
      <AudioProvider>
        <SaveBlobProvider>
          <PockitToy roomId='my-room-id' />
        </SaveBlobProvider>
      </AudioProvider>
    </IframePositionWrapper>
  )
}

const IframePositionWrapper = ({ children }: { children: React.ReactNode }) => {
  const isInsideIframe = window && (window.self !== window.top);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return isInsideIframe ? <div className='z-50'>{children}</div> :
    <div className={`fixed w-screen ${isIOS ? 'h-[calc(100%+env(safe-area-inset-top))]' : 'h-screen'} pointer-events-none select-none z-50`}>
      <SkyShader />
      <div className={`${isIOS ? 'bottom-8' : 'bottom-2'} left-1/2 -translate-x-1/2 absolute transition-all pointer-events-auto flex flex-col`}>
        {children}
      </div>
    </div>
}


export default App
