import './App.css'
import PockitToy from './PockitConsole/MP'
import { AudioProvider } from './shared/AudioProvider'
import SaveBlobProvider from './shared/SaveBlobProvider'
import { useEffect, useState } from 'react';

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

  // @ts-expect-error only exists on iOS
  const isIOSStandalone = window.navigator.standalone
  // const isAndroidStandalone = window.matchMedia('(display-mode: standalone)').matches;

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isInsideIframe) {
      document.body.style.background = 'transparent';
      document.body.style.backgroundImage = 'none';
    }
  }, [isInsideIframe]);

  return isInsideIframe ? <div className='z-50 max-w-[400px] h-[220px]'>{children}</div> :
    <>
      {/* {loaded && <div className='bg-red-500'>{Array.from({ length: 100 }).map((_, i) => <div key={i} className=''>{i}</div>)}</div>} */}
      <div className={`fixed overflow-hidden w-screen ${isIOSStandalone ? 'h-[calc(100vh+env(safe-area-inset-bottom))]' : 'h-screen'} overflow-none pointer-events-none select-none z-50`}>
        <div className={`fixed transition-all ease-in-out duration-500 ${isInsideIframe ? "h-[220px] w-[400px]" : "h-[220px] w-[92vw] md:w-[400px]"} ${!loaded ? '-bottom-[200px] scale-[90%]' : isIOSStandalone ? 'bottom-4' : isIOS ? 'bottom-4' : 'bottom-2'} left-1/2 -translate-x-1/2 absolute transition-all pointer-events-auto flex flex-col`}>
          {children}
        </div>
      </div>
    </>
}


export default App
