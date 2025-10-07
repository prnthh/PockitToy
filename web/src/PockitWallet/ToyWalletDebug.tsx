import React, { useState, useEffect } from 'react';

interface SecureAccount { address: `0x${string}` }

// Match the state shape used in ToyWalletProvider
interface WalletState {
    pin: string;
    unlocked: boolean;
    account: SecureAccount | null;
    showPinInput: boolean;
    walletExists: boolean;
}

interface UnsealedMessage {
    message: string;
    from?: string;
}

interface Props {
    walletState: WalletState;
    initialTargetPublicKey: string;
    error: string;
    setError: (error: string) => void;
    handleCopyAddress: () => Promise<void> | void;
    handleCopyPrivateKey: () => Promise<void> | void;
    handleSignMessage: (message: string, useIdentityMode: boolean) => Promise<string>;
    handleCreateTestSeal: (message: string, targetPublicKey: string, useIdentityMode: boolean) => Promise<string>;
    handleUnsealMessage: (sealedMessage: string) => Promise<UnsealedMessage | null>;
    handleFileSelect: (file: File | null) => Promise<void> | void;
    handleResetWallet: () => void;
    onClose: () => void;
}

export default function ToyWalletDebug({
    walletState,
    initialTargetPublicKey,
    error,
    setError,
    handleCopyAddress,
    handleCopyPrivateKey,
    handleSignMessage,
    handleCreateTestSeal,
    handleUnsealMessage,
    handleFileSelect,
    handleResetWallet,
    onClose,
}: Props) {
    // Local UI state for debug panel
    const [message, setMessage] = useState('');
    const [signature, setSignature] = useState('');
    const [sealedMessage, setSealedMessage] = useState('');
    const [unsealedMessage, setUnsealedMessage] = useState('');
    const [unsealedFrom, setUnsealedFrom] = useState<string | undefined>();
    const [targetPublicKey, setTargetPublicKey] = useState(initialTargetPublicKey);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [useIdentityMode, setUseIdentityMode] = useState(true);

    // Update target public key when wallet changes
    useEffect(() => {
        if (initialTargetPublicKey && !targetPublicKey) {
            setTargetPublicKey(initialTargetPublicKey);
        }
    }, [initialTargetPublicKey]);

    const onSignMessage = async () => {
        const result = await handleSignMessage(message, useIdentityMode);
        if (result) {
            setSignature(result);
        }
    };

    const onCreateTestSeal = async () => {
        const result = await handleCreateTestSeal(message, targetPublicKey, useIdentityMode);
        if (result) {
            setSealedMessage(result);
        }
    };

    const onUnsealMessage = async () => {
        const result = await handleUnsealMessage(sealedMessage);
        if (result) {
            setUnsealedMessage(result.message);
            setUnsealedFrom(result.from);
        }
    };

    const onCopyAddress = async () => {
        await handleCopyAddress();
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const onCopyPrivateKey = async () => {
        await handleCopyPrivateKey();
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };
    return (
        <div className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl text-xs max-w-4xl w-full z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-300 font-mono text-xs font-semibold">TOY WALLET DEBUG</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors text-xs"
                    title="Close debug panel"
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div className="p-3">
                {walletState.unlocked ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Wallet Management Column */}
                        <div className="space-y-3">
                            <div className="bg-gray-800/30 rounded p-3 border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-gray-300 font-semibold text-xs">WALLET</h3>
                                    <div className="flex space-x-1">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                        <span className="text-green-400 text-xs">ACTIVE</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="bg-gray-700/50 rounded px-2 py-1">
                                        <div className="text-gray-400 text-xs mb-1">Address</div>
                                        <div className="font-mono text-gray-200 text-xs break-all">
                                            {walletState.account?.address}
                                        </div>
                                    </div>
                                    <div className="bg-gray-700/50 rounded px-2 py-1">
                                        <div className="text-gray-400 text-xs mb-1">Public Key</div>
                                        <div className="font-mono text-gray-200 text-xs break-all max-h-20 overflow-y-auto">
                                            {initialTargetPublicKey}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={onCopyAddress}
                                            className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-xs transition-colors border border-blue-600/30"
                                            title="Copy address"
                                        >
                                            📋 Addr
                                        </button>
                                        <button
                                            onClick={onCopyPrivateKey}
                                            className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 px-2 py-1 rounded text-xs transition-colors border border-red-600/30"
                                            title="Download private key as pockit.key file (dangerous!)"
                                        >
                                            � Export
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Crypto Operations Column */}
                        <div className="space-y-3">
                            <div className="bg-gray-800/30 rounded p-3 border border-gray-700">
                                <h3 className="text-gray-300 font-semibold text-xs mb-2">CRYPTO OPS</h3>
                                <div className="space-y-3">
                                    {/* Message Input */}
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Message to sign/seal..."
                                        className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                    />

                                    {/* Target Public Key Input */}
                                    <input
                                        type="text"
                                        value={targetPublicKey}
                                        onChange={(e) => setTargetPublicKey(e.target.value)}
                                        placeholder="Recipient public key (hex, 0x... or raw)"
                                        className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                    />

                                    {/* Unified Mode Toggle */}
                                    <div className="bg-gray-700/50 rounded px-2 py-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 text-xs">Mode</span>
                                            <button
                                                onClick={() => setUseIdentityMode(!useIdentityMode)}
                                                className={`px-2 py-0.5 rounded text-xs transition-colors ${useIdentityMode
                                                    ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                                                    : 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                                                    }`}
                                            >
                                                {useIdentityMode ? '🔑 Identity' : '👻 Anonymous'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex space-x-1">
                                        <button
                                            onClick={onSignMessage}
                                            className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 px-2 py-1 rounded text-xs transition-colors border border-green-600/30 disabled:opacity-50"
                                            disabled={!message.trim()}
                                            title="Sign message"
                                        >
                                            ✍️ Sign
                                        </button>
                                        <button
                                            onClick={onCreateTestSeal}
                                            className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded text-xs transition-colors border border-yellow-600/30 disabled:opacity-50"
                                            disabled={!message.trim() || !targetPublicKey.trim()}
                                            title="Seal with public key"
                                        >
                                            🔒 Seal
                                        </button>
                                    </div>

                                    {/* Signature Display */}
                                    {signature && (
                                        <div className="bg-green-900/20 border border-green-600/30 rounded px-2 py-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-green-400 text-xs font-semibold">SIGNED MESSAGE</span>
                                                <button
                                                    onClick={() => setSignature('')}
                                                    className="text-green-400 hover:text-green-300 text-xs"
                                                    title="Clear"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className="font-mono text-green-200 text-xs break-all max-h-24 overflow-y-auto">
                                                {signature}
                                            </div>
                                        </div>
                                    )}

                                    {/* Sealed Message Input */}
                                    <textarea
                                        value={sealedMessage}
                                        onChange={(e) => setSealedMessage(e.target.value)}
                                        placeholder="Sealed message..."
                                        className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none"
                                        rows={2}
                                    />

                                    {/* Unseal Button */}
                                    <button
                                        onClick={onUnsealMessage}
                                        className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-xs transition-colors border border-blue-600/30 disabled:opacity-50"
                                        disabled={!sealedMessage.trim()}
                                    >
                                        🔓 Unseal
                                    </button>

                                    {/* Unsealed Message Display */}
                                    {unsealedMessage && (
                                        <div className="bg-green-900/20 border border-green-600/30 rounded px-2 py-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-green-400 text-xs font-semibold">UNSEALED MESSAGE</span>
                                                <button
                                                    onClick={() => {
                                                        setUnsealedMessage('');
                                                        setUnsealedFrom(undefined);
                                                    }}
                                                    className="text-green-400 hover:text-green-300 text-xs"
                                                    title="Clear"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            {unsealedFrom && (
                                                <div className="mb-1 pb-1 border-b border-green-600/20">
                                                    <span className="text-green-500 text-xs">From: </span>
                                                    <span className="font-mono text-green-300 text-xs">{unsealedFrom}</span>
                                                </div>
                                            )}
                                            {!unsealedFrom && (
                                                <div className="mb-1 pb-1 border-b border-green-600/20">
                                                    <span className="text-gray-500 text-xs italic">Anonymous sender</span>
                                                </div>
                                            )}
                                            <div className="font-mono text-green-200 text-xs break-all max-h-12 overflow-y-auto">
                                                {unsealedMessage}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : walletState.walletExists ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center space-y-3">
                            <div className="text-gray-400 text-sm">🔒 Wallet Locked</div>
                            <button
                                onClick={handleResetWallet}
                                className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-4 py-2 rounded text-xs transition-colors border border-red-600/30"
                                title="Clear wallet data and start fresh"
                            >
                                🗑️ Reset Wallet
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto space-y-3">
                        <div className="bg-gray-800/30 rounded p-3 border border-gray-700">
                            <h3 className="text-gray-300 font-semibold text-xs mb-2">IMPORT PRIVATE KEY</h3>
                            <div className="space-y-2">
                                <input
                                    type="file"
                                    accept=".key,.txt"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleFileSelect(file);
                                    }}
                                    className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30"
                                />
                                <div className="text-gray-500 text-xs text-center">
                                    Select a pockit.key file to import
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="mt-3 bg-red-900/20 border border-red-600/30 rounded px-3 py-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                            <span className="text-red-400 text-xs font-semibold">ERROR</span>
                        </div>
                        <div className="text-red-300 text-xs mt-1">{error}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
