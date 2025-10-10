import { useState, useEffect } from 'react';
import { useToyWallet } from './ToyWalletProvider';

interface Props { onClose: () => void; }

export default function ToyWalletDebug({ onClose }: Props) {
    const { walletState, handleSign, handleSeal, handleUnseal, handleVerify, handleReset, copyAddress, copyPublicKey, handleFileSelect, getPrivateKey, keyExists } = useToyWallet();

    const [message, setMessage] = useState('');
    const [output, setOutput] = useState('');
    const [result, setResult] = useState<{ type: 'verify' | 'unseal'; valid?: boolean; message: string; from?: string } | null>(null);
    const [targetKey, setTargetKey] = useState(walletState.publicKey);
    const [useIdentityMode, setUseIdentityMode] = useState(true);
    const [copyFeedback, setCopyFeedback] = useState(false);

    useEffect(() => {
        if (walletState.publicKey && !targetKey) setTargetKey(walletState.publicKey);
    }, [walletState.publicKey, targetKey]);

    const showFeedback = () => { setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); };
    const isSealed = (str: string) => {
        try { const p = JSON.parse(str); return p?.senderPubKey && p?.from && p?.data; } catch { return false; }
    };

    const actions = {
        sign: async () => { const r = await handleSign(message, useIdentityMode); if (r) { setOutput(r); setResult(null); } },
        seal: async () => { const r = await handleSeal(message, targetKey, useIdentityMode); if (r) { setOutput(r); setResult(null); } },
        verify: async () => { const r = await handleVerify(output); if (r) setResult({ type: 'verify', ...r }); },
        unseal: async () => { const r = await handleUnseal(output); if (r) setResult({ type: 'unseal', ...r }); },
        copyAddr: async () => { await copyAddress(); showFeedback(); },
        copyPubKey: async () => { await copyPublicKey(); showFeedback(); },
        exportKey: async () => {
            const key = await getPrivateKey();
            if (key) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([key]));
                a.download = 'pockit.key';
                a.click();
                showFeedback();
            }
        }
    };
    return (
        <div className="fixed -top-[calc(50vh-100%)] left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl text-xs max-w-4xl w-full z-50 max-h-[90vh] overflow-y-auto noscrollbar">
            <div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className='w-2' />

                <div className="flex justify-center items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-300 font-mono text-xs font-semibold">TOY WALLET DEBUG</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xs">✕</button>
            </div>

            <div className="p-4">
                {walletState.unlocked ? (
                    <div className="space-y-2">
                        {/* Wallet Info */}
                        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700 grid grid-cols-2 gap-4">
                            <button onClick={actions.copyAddr} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-xs transition-colors border border-blue-600/30">📋 Copy Address</button>
                            <div className="flex items-center justify-center space-x-2">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                <span className="text-green-400 text-xs font-mono">WALLET ACTIVE</span>
                            </div>
                            <button onClick={actions.copyPubKey} className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-2 py-1 rounded text-xs transition-colors border border-green-600/30">🔑 Copy Public Key</button>
                            <button onClick={actions.exportKey} className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-2 py-1 rounded text-xs transition-colors border border-red-600/30">💾 Export Key</button>
                        </div>
                        {copyFeedback && <div className="text-green-400 text-center text-xs font-mono">Copied to clipboard!</div>}

                        {/* Input Section */}
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700 space-y-4">
                            <h3 className="text-blue-300 font-semibold text-sm mb-3 flex items-center">
                                <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">1</span>
                                INPUT & SETTINGS
                            </h3>

                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter your message here..." className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none" rows={3} />

                            <div className='flex justify-around items-end text-center'>
                                <div className='flex flex-col items-center'>
                                    <button onClick={actions.sign} disabled={!message.trim()} className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-6 py-2 rounded-lg text-sm transition-colors border border-green-600/30 disabled:opacity-50 flex items-center space-x-2">
                                        <span>✍️ Sign</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-y-1">
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 block">Recipient Key (for sealing):</label>
                                        <input type="text" value={targetKey} onChange={(e) => setTargetKey(e.target.value)} placeholder="Public key..." className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={() => setUseIdentityMode(!useIdentityMode)} className={`px-3 py-1 rounded text-xs transition-colors w-full ${useIdentityMode ? 'bg-green-600/20 text-green-300 border border-green-600/30' : 'bg-purple-600/20 text-purple-300 border border-purple-600/30'}`}>
                                            {useIdentityMode ? '🔑 Identity' : '👻 Anonymous'}
                                        </button>
                                    </div>
                                    <button onClick={actions.seal} disabled={!message.trim() || !targetKey.trim()} className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded-lg text-sm transition-colors border border-orange-600/30 disabled:opacity-50">
                                        <span>🔒 Seal</span>
                                    </button>
                                </div>


                            </div>
                        </div>

                        {/* Output Section */}
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700 space-y-4">
                            <h3 className="text-yellow-300 font-semibold text-sm mb-3 flex items-center">
                                <span className="bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">2</span>
                                OUTPUT & VERIFY
                            </h3>

                            <textarea value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Signed/sealed output..." className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 resize-none font-mono" rows={4} />

                            <div className="flex justify-center space-x-4">
                                <button onClick={actions.verify} disabled={!output.trim() || isSealed(output)} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-6 py-2 rounded-lg text-sm transition-colors border border-blue-600/30 disabled:opacity-50">🔍 Verify</button>
                                <button onClick={actions.unseal} disabled={!output.trim() || !isSealed(output)} className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-6 py-2 rounded-lg text-sm transition-colors border border-purple-600/30 disabled:opacity-50">🔓 Unseal</button>
                            </div>
                        </div>

                        {/* Results */}
                        {result && (
                            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-green-300 font-semibold text-sm flex items-center">
                                        <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">3</span>
                                        {result.type === 'verify' ? (result.valid ? '✅ VALID SIGNATURE' : '❌ INVALID SIGNATURE') : '🔓 UNSEALED MESSAGE'}
                                    </h3>
                                    <button onClick={() => setResult(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                                </div>
                                {result.from && <div className="text-xs mb-2"><span className="text-gray-400">{result.type === 'verify' ? 'Signer:' : 'From:'} </span><span className="font-mono text-green-300">{result.from}</span></div>}
                                <div className="text-xs"><span className="text-gray-400">Message: </span><div className="mt-1 font-mono bg-gray-800/50 rounded p-2 break-all text-green-300">{result.message}</div></div>
                            </div>
                        )}
                    </div>
                ) : keyExists() ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center space-y-3">
                            <div className="text-gray-400 text-sm">🔒 Wallet Locked</div>
                            <button onClick={handleReset} className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-4 py-2 rounded text-xs transition-colors border border-red-600/30">🗑️ Reset Wallet</button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto space-y-3">
                        <div className="bg-gray-800/30 rounded p-3 border border-gray-700">
                            <h3 className="text-gray-300 font-semibold text-xs mb-2">IMPORT PRIVATE KEY</h3>
                            <input type="file" accept=".key,.txt" onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500 file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30" />
                            <div className="text-gray-500 text-xs text-center mt-2">Select a pockit.key file to import</div>
                        </div>
                    </div>
                )}

                {walletState.error && (
                    <div className="mt-3 bg-red-900/20 border border-red-600/30 rounded px-3 py-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                            <span className="text-red-400 text-xs font-semibold">ERROR</span>
                        </div>
                        <div className="text-red-300 text-xs mt-1">{walletState.error}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
