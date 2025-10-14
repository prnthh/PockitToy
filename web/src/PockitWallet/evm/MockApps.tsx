import { useState, } from "react";
import { encodeFunctionData, decodeFunctionResult, type Abi, formatEther } from 'viem';



// ------------------------
// Mock client: reads a value from a contract using the injected provider
// This uses viem's ABI helpers for encoding/decoding, and calls window.ethereum.request({ method: 'eth_call' })
// so it talks to the provider installed by this file.
function MockContractReader2({
    contractAddress,
    abi,
    functionName,
    args
}: {
    contractAddress: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: unknown[];
}) {
    const [value, setValue] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function readBalance(targetAddress: `0x${string}` = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045') {
        if (!window.ethereum) return;
        setLoading(true);
        try {
            const res = await window.ethereum.request({ method: 'eth_getBalance', params: [targetAddress, 'latest'] });

            if (typeof res === 'string') {
                try {
                    const wei = BigInt(res as `0x${string}`);
                    setBalance(formatEther(wei));
                } catch (err) {
                    setBalance(null);
                }
            }
        } catch (err: any) {
            console.error('readBalance error', err);
            setBalance(null);
        } finally {
            setLoading(false);
        }
    }

    const readValue = async () => {
        setError(null);
        setLoading(true);
        try {
            if (!window.ethereum) throw new Error('No injected provider (window.ethereum)');

            const data = encodeFunctionData({ abi, functionName, args: (args as any[]) ?? [] });

            const res = await window.ethereum.request({
                method: 'eth_call',
                params: [{ to: contractAddress, data }, 'latest']
            });

            if (typeof res !== 'string') throw new Error('Unexpected eth_call response');

            const decoded = decodeFunctionResult({ abi, functionName, data: res as `0x${string}` });
            setValue(decoded);
        } catch (err: any) {
            setError(err?.message ?? String(err));
            setValue(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <CartridgeWrapper className="bg-white shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-2">

            <div className=" text-xs">
                <span className='text-slate-700 italic text-xl font-bold'>Ethereum Cartridge</span>

                <div>Contract: {contractAddress}</div>
                <div>Method: {functionName}</div>
                <button onClick={readValue} disabled={loading}>
                    {loading ? 'Reading...' : 'Read from chain'}
                </button>
                {error && <div style={{ color: 'red' }}>Error: {error}</div>}
                {value !== null && (
                    <div>
                        <strong>Result:</strong>
                        <pre>{JSON.stringify(value, null, 2)}</pre>
                    </div>
                )}
            </div>
            <div className="flex flex-col items-center space-x-2">
                <button onClick={() => readBalance()} className="px-2 py-1 rounded bg-blue-600 text-white">Read balance</button>
                {loading ? <span>Loading…</span> : <span>{balance !== null ? `Balance: ${balance}` : '—'}</span>}
            </div>
        </CartridgeWrapper>
    );
}

function Game() {
    return (
        <CartridgeWrapper className="bg-red-500 shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-2">
            <span className='text-slate-700 italic text-xl font-bold'>Cheese Blaster</span>
            <div className="flex flex-col items-center space-x-2">
            </div>
        </CartridgeWrapper>
    );
}

export default function EthereumCartridgeCarousel() {
    return <div className='absolute noscrollbar pl-[30vw] bottom-[240px] pb-[30px] overflow-x-auto w-screen flex gap-x-8 pointer-events-none z-[20]'>
        <MockContractReader2
            contractAddress={'0x0000000000000000000000000000000000000000'}
            abi={[
                {
                    type: 'function',
                    name: 'name',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'string' }],
                },
            ]}
            functionName={'name'}
        />
        <Game />
    </div>
}

function CartridgeWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`relative pointer-events-auto h-[200px] min-w-[200px] max-w-[96vw]  noscrollbar z-[20] ${className}`}>
        {children}

        {/* ports */}
        <div className="absolute top-[100%] left-1/2 -translate-x-1/2">
            <div className="w-[22px] h-[12px] bg-gray-400 rounded-b" />
        </div>
    </div >
}


