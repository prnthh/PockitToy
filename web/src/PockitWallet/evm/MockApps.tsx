import { useState } from "react";
import { encodeFunctionData, decodeFunctionResult, type Abi, formatEther } from 'viem';

function MockContractReader() {
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // read ETH balance of a famous wallet (Vitalik) on the provider's network
    const targetAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik

    async function readBalance() {
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

    return (
        <div className="mt-2 text-xs">
            <div className="flex items-center space-x-2">
                <button onClick={readBalance} className="px-2 py-1 rounded bg-blue-600 text-white">Read balance</button>
                {loading ? <span>Loading…</span> : <span>{balance !== null ? `Balance: ${balance}` : '—'}</span>}
            </div>
        </div>
    );
}


// ------------------------
// Mock client: reads a value from a contract using the injected provider
// This uses viem's ABI helpers for encoding/decoding, and calls window.ethereum.request({ method: 'eth_call' })
// so it talks to the provider installed by this file.
export function MockContractReader2({
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        <div className=" text-xs">
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
    );
}

export { MockContractReader };

export default function EthereumCartridge() {
    return <div className='absolute h-[200px] overflow-y-auto noscrollbar bottom-[300px] left-1/2 -translate-x-1/2 z-[20] bg-slate-300/50 rounded-2xl p-4 shadow-lg flex flex-col gap-4 items-center'>
        <span className='text-slate-700 italic text-xl font-bold'>Ethereum Cartridge</span>
        <MockContractReader />
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
    </div>
}