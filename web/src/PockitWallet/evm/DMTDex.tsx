import { CartridgeWrapper } from '@/PockitConsole/carts/MockApps';
import { useEthereum } from './EthereumProvider';
import { useEffect, useState } from 'react';
import { formatEther, parseEther } from 'viem';


// ------------------------
// Mock client: reads a value from a contract using the injected provider
// This uses viem's ABI helpers for encoding/decoding, and calls window.ethereum.request({ method: 'eth_call' })
// so it talks to the provider installed by this file.
function DMTDex() {
    const { provider, client } = useEthereum();
    const [balance, setBalance] = useState<string | null>(null);
    const [myBalance, setMyBalance] = useState<string | null>(null);

    useEffect(() => {
        if (!client || typeof client.getBalance !== 'function') return;
        // you can now use provider.request({ method: 'eth_call', params: [...] }) to read from contracts
        // or provider.request({ method: 'eth_sendTransaction', params: [...] }) to send transactions
        // see https://eips.ethereum.org/EIPS/eip-1193 for details
        console.log('DMTDex: detected provider', provider);
        console.log('DMTDex: detected client', client);

        // Read Vitalik's ETH balance using Viem's getBalance
        const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        client.getBalance({ address: vitalikAddress })
            .then((balance: bigint) => {
                console.log('Vitalik\'s ETH balance:', balance);
                console.log('Is > 10,000 ETH?', balance > 10000000000000000000000n);
                setBalance(formatEther(balance));
            })
            .catch((err: any) => console.error('Error reading balance:', err));

    }, [client]);

    return (
        <CartridgeWrapper className="bg-white shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-2">
            <div className=" text-xs">
                <span className='text-slate-700 italic text-xl font-bold'>DMT Cartridge</span>
                {<div>My wallet: {client?.account}</div>}
                {<div>My Balance: {myBalance}</div>}

                {<div>Vitalik's Balance: {balance}</div>}
            </div>
            <div>
                <button
                    onClick={async () => {
                        if (!client || typeof client.sendTransaction !== 'function') {
                            alert('Wallet not available for sending transactions');
                            return;
                        }
                        try {
                            const txHash = await client.sendTransaction({
                                to: '0x000000000000000000000000000000000000dead',
                                value: parseEther('0.001'),
                            });
                            console.log('Transaction sent, hash:', txHash);
                            alert(`Transaction sent! Hash: ${txHash}`);
                        }
                        catch (err) {
                            console.error('Error sending transaction:', err);
                            alert(`Error sending transaction: ${err}`);
                        }
                    }}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                    disabled={!client || typeof client.sendTransaction !== 'function'}
                >
                    Send 0.001 ETH to 0x...dead
                </button>
            </div>
        </CartridgeWrapper>
    );
}

export default DMTDex;