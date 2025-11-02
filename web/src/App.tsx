import './App.css'
import PockitToy from './PockitConsole/MP'
import { EVMWrapper } from './PockitWallet/evm/EthereumProvider';
import { ToyWalletProvider } from './PockitWallet/ToyWalletProvider';
import { AudioProvider } from './shared/AudioProvider'
import SkyShader from './shared/GLSLCanvas';
import SaveBlobProvider from './shared/SaveBlobProvider'
import { lazy, useEffect, useState } from 'react';

const AppCarousel = lazy(() => import("./PockitConsole/carts/MockApps"));

function App() {

  return (
    <AudioProvider>
      <SaveBlobProvider>
        <ToyWalletProvider>
          <EVMWrapper>
            <IframePositionWrapper>
              <PockitToy roomId='my-room-id' />
            </IframePositionWrapper >
          </EVMWrapper>
        </ToyWalletProvider>
      </SaveBlobProvider>
    </AudioProvider>
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

  return isInsideIframe ? <div className='z-50 max-w-[400px] h-[220px]'>
    <ToyLabel />
    {children}
  </div> :
    <>
      <SkyShader />
      <AppCarousel />
      <div className={`fixed overflow-hidden w-screen ${isIOSStandalone ? 'h-[calc(100vh+env(safe-area-inset-bottom))]' : 'h-screen'} overflow-none pointer-events-none select-none z-50`}>
        <div className={`fixed transition-all ease-in-out duration-500 ${isInsideIframe ? "h-[220px] w-[400px]" : "h-[220px] w-[92vw] md:w-[400px]"} ${!loaded ? '-bottom-[200px] scale-[90%]' : isIOSStandalone ? 'bottom-4' : isIOS ? 'bottom-4' : 'bottom-2'} left-1/2 -translate-x-1/2 absolute transition-all pointer-events-auto flex flex-col`}>
          <ToyLabel />
          {children}
        </div>
      </div>
    </>
}

const ToyLabel = () => {
  return <div className='absolute -left-[42px] w-[42px] z-50 bottom-[50px] bg-slate-700/50 rounded-l-sm italic text-xs text-white py-1 text-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'>wallet</div>
}


export default App
