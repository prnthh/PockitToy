import { CartridgeWrapper } from '@/PockitConsole/carts/MockApps';
import { useEthereum } from './EthereumProvider';

function TaskSignalCart() {
    const { client } = useEthereum();

    return (
        <CartridgeWrapper className="bg-white shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-2">
            <div className="px-2 text-xs">
                <span className='text-slate-700 italic text-xl font-bold'>Task Cartridge</span>
                <div>
                    {client?.account ? 'connected' : 'not connected'}
                </div>

                {client?.account && <button onClick={async () => {
                    if (!client?.account) return;
                    console.log('claim')
                    window.postMessage({ type: 'POCKIT_CHAT', payload: { message: "/claim" } }, '*');
                    window.postMessage({ type: 'ping', payload: { account: client.account } }, '*');
                }}>
                    claim
                </button>}
            </div>

        </CartridgeWrapper>
    );
}

export default TaskSignalCart;