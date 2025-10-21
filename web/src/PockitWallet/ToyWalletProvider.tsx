import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, verifyMessage } from "viem";
import * as secp from '@noble/secp256k1';
import ToyWalletDebug from './ToyWalletDebug';
import localforage from 'localforage';

// (no global cache) provider will maintain a synchronous keyExists() via state

// ==================== TYPES ====================
interface UnsealedMessage {
    message: string;
    from?: string;
}

interface WalletState {
    unlocked: boolean;
    address: string;
    publicKey: string;
    showPinInput: boolean;
    error: string;
}

interface ToyWalletContextType {
    // State
    walletState: WalletState;

    // Core wallet functions
    unlock: (pin: string) => Promise<void>;
    lock: () => void;
    getPrivateKey: () => Promise<`0x${string}` | null>;

    // Cryptographic functions
    handleSign: (message: string) => Promise<{ m: any; s: string; f: string } | null>;
    handleSeal: (message: string, targetPublicKey: string, useIdentityMode: boolean) => Promise<string>;
    handleUnseal: (sealedMessage: string) => Promise<UnsealedMessage | null>;
    handleVerify: ({ m, s, f }: { m: any; s: string; f: string }) => Promise<{ valid: boolean; message: any; from?: string } | null>;

    // Utility functions
    handleReset: () => void;
    copyAddress: () => Promise<void>;
    copyPublicKey: () => Promise<void>;
    handleFileSelect: (file: File | null) => Promise<void>;

    // UI state management
    setShowPinInput: (show: boolean) => void;
    setError: (error: string) => void;
    keyExists: () => boolean;
}

const ToyWalletContext = createContext<ToyWalletContextType | null>(null);

// ==================== SIMPLE UTILITIES ====================
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string) => new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));

function formatPublicKeyShort(pk?: string) {
    if (!pk || pk.length <= 24) return pk || '';
    return `${pk.slice(0, 10)}…${pk.slice(-6)}`;
}

// Get compressed public key from private key
function getCompressedPublicKey(privateKeyHex: `0x${string}`): string {
    const privateKeyBytes = hexToBytes(privateKeyHex);
    const publicKeyBytes = secp.getPublicKey(privateKeyBytes, true); // true = compressed
    const hex = Array.from(publicKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hex}`;
}

// ==================== SIMPLE SEAL/UNSEAL ====================
// Main seal function - works with or without identity
// If getPrivateKey is provided and returns a key, uses it for identity sealing
// If getPrivateKey is not provided or returns null, creates anonymous ephemeral seal
async function sealMessage(
    message: string,
    recipientPublicKeyHex: string,
    getPrivateKey?: () => Promise<`0x${string}` | null>
): Promise<string> {
    const recipientPubKey = hexToBytes(recipientPublicKeyHex.startsWith('0x') ? recipientPublicKeyHex as `0x${string}` : `0x${recipientPublicKeyHex}` as `0x${string}`);

    let senderPrivKey: Uint8Array;
    let senderPubKeyForEnvelope: string;
    let fromAddress: string | undefined;

    // Try to get private key just-in-time if getter function is provided
    const senderPrivateKeyHex = getPrivateKey ? await getPrivateKey() : null;

    if (senderPrivateKeyHex) {
        // Identity seal: Include sender identity
        senderPrivKey = hexToBytes(senderPrivateKeyHex);
        senderPubKeyForEnvelope = getCompressedPublicKey(senderPrivateKeyHex);
        const account = privateKeyToAccount(senderPrivateKeyHex);
        fromAddress = account.address;
    } else {
        // Anonymous seal: use ephemeral key
        const ephemeralKey = generatePrivateKey();
        senderPrivKey = hexToBytes(ephemeralKey);
        senderPubKeyForEnvelope = getCompressedPublicKey(ephemeralKey);
        fromAddress = undefined;
    }

    // Get shared secret using secp256k1
    const sharedSecret = secp.getSharedSecret(senderPrivKey, recipientPubKey, true); // true = compressed
    const sharedKey = sharedSecret.slice(1, 33); // Remove prefix byte, take 32 bytes

    // Derive AES key from shared secret
    const aesKey = await crypto.subtle.importKey(
        'raw',
        sharedKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    // Create IV from hash of shared key
    const ivHash = await crypto.subtle.digest('SHA-256', sharedKey);
    const iv = new Uint8Array(ivHash).slice(0, 12);

    // Encrypt message
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(message)
    );

    // Return envelope with sender's public key and encrypted data
    return JSON.stringify({
        senderPubKey: senderPubKeyForEnvelope,
        from: fromAddress,
        data: toBase64(new Uint8Array(encrypted))
    });
}

async function unsealMessage(
    sealedMessage: string,
    getPrivateKey: () => Promise<`0x${string}` | null>
): Promise<UnsealedMessage> {
    const myPrivateKeyHex = await getPrivateKey();
    if (!myPrivateKeyHex) {
        throw new Error('Private key required to unseal message');
    }

    const envelope = JSON.parse(sealedMessage);
    const senderPubKey = hexToBytes(envelope.senderPubKey as `0x${string}`);
    const myPrivKey = hexToBytes(myPrivateKeyHex);

    // Get shared secret (same as sender calculated)
    const sharedSecret = secp.getSharedSecret(myPrivKey, senderPubKey, true); // true = compressed
    const sharedKey = sharedSecret.slice(1, 33); // Remove prefix byte, take 32 bytes

    // Derive same AES key
    const aesKey = await crypto.subtle.importKey(
        'raw',
        sharedKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    // Derive same IV
    const ivHash = await crypto.subtle.digest('SHA-256', sharedKey);
    const iv = new Uint8Array(ivHash).slice(0, 12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        fromBase64(envelope.data)
    );

    return {
        message: new TextDecoder().decode(decrypted),
        from: envelope.from
    };
}

// ==================== ENCRYPTED STORAGE ====================
// Derive AES key and IV from PBKDF2 output (deriveBits). We return both the CryptoKey and the IV bytes.
async function deriveKeyAndIv(pin: string, salt: Uint8Array): Promise<{ key: CryptoKey; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);

    const baseKey = await crypto.subtle.importKey(
        'raw',
        pinData,
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive 256 bits for AES key + 96 bits for IV = 352 bits
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        352
    );

    const bytes = new Uint8Array(bits);
    const keyBytes = bytes.slice(0, 32); // 256 bits
    const ivBytes = bytes.slice(32, 32 + 12); // 96 bits

    const aesKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    return { key: aesKey, iv: ivBytes };
}

function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16)); // 128-bit salt
}

async function encryptPrivateKey(privateKeyHex: `0x${string}`, pin: string): Promise<string> {
    const salt = generateSalt();
    const { key, iv } = await deriveKeyAndIv(pin, salt);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        new TextEncoder().encode(privateKeyHex)
    );

    // Store salt + encrypted data; IV is derived from (pin, salt) so we don't store it
    return JSON.stringify({
        salt: toBase64(salt),
        data: toBase64(new Uint8Array(encrypted))
    });
}

async function decryptPrivateKey(encryptedData: string, pin: string): Promise<`0x${string}` | null> {
    try {
        const { salt, data } = JSON.parse(encryptedData);
        const saltBytes = fromBase64(salt);
        const { key, iv } = await deriveKeyAndIv(pin, saltBytes);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            key,
            fromBase64(data)
        );

        return new TextDecoder().decode(decrypted) as `0x${string}`;
    } catch {
        return null; // Decryption failed (wrong PIN or corrupted data)
    }
}

async function saveEncryptedKey(privateKeyHex: `0x${string}`, pin: string) {
    const encrypted = await encryptPrivateKey(privateKeyHex, pin);
    // Persist using localforage (IndexedDB preferred).
    try {
        await localforage.setItem('wallet', encrypted);
    } catch {
        // ignore
    }
}

async function loadDecryptedKey(pin: string): Promise<`0x${string}` | null> {
    try {
        const stored = await localforage.getItem<string>('wallet');
        if (!stored) return null;
        return await decryptPrivateKey(stored, pin);
    } catch {
        return null;
    }
}

async function removeKey() {
    try { await localforage.removeItem('wallet'); } catch { /* ignore */ }
}

// ==================== PROVIDER IMPLEMENTATION ====================
export function ToyWalletProvider({ children }: { children: ReactNode }) {
    const [currentPin, setCurrentPin] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [address, setAddress] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [showPinInput, setShowPinInput] = useState(false);
    const [error, setError] = useState('');
    const [hasStoredKey, setHasStoredKey] = useState(false);
    useEffect(() => {
        let mounted = true;
        localforage.getItem('wallet').then((res) => {
            if (!mounted) return;
            setHasStoredKey(!!res);
            if (!res) lock();
        }).catch(() => {
            lock();
        });
        return () => { mounted = false; };
    }, []);

    // Helper to get private key when needed
    const getPrivateKey = async (): Promise<`0x${string}` | null> => {
        if (!unlocked || !currentPin) return null;
        return await loadDecryptedKey(currentPin);
    };

    const unlock = async (pin: string) => {
        if (pin.length !== 4) {
            setError('Need 4-digit PIN');
            return;
        }

        setError('');
        const walletExists = hasStoredKey;
        let key = await loadDecryptedKey(pin);

        if (!key && !walletExists) {
            // Create new wallet
            key = generatePrivateKey();
            await saveEncryptedKey(key, pin);
        } else if (!key && walletExists) {
            // Wallet exists but wrong PIN
            setError('Incorrect PIN');
            return;
        }

        if (key) {
            const account = privateKeyToAccount(key);
            const pubKey = getCompressedPublicKey(key);

            setCurrentPin(pin);
            setAddress(account.address);
            setPublicKey(pubKey);
            setUnlocked(true);
            setShowPinInput(false);
            setHasStoredKey(true);
        }
    };

    const lock = () => {
        setCurrentPin('');
        setAddress('');
        setPublicKey('');
        setUnlocked(false);
        setShowPinInput(false);
    };

    const handleSign = async (message: string): Promise<{ m: string; s: string; f: string }> => {
        try {
            const privateKey = await getPrivateKey();

            if (!privateKey) {
                return Promise.reject(new Error('Wallet locked or no private key'));
            }

            const account = privateKeyToAccount(privateKey);
            const fromAddress = account.address;

            setError('');
            return {
                m: message,
                s: await account.signMessage({ message }),
                f: fromAddress
            };
        } catch (err: any) {
            console.error('Failed to sign message:', err);
            return err;
        }
    };

    const handleVerify = async ({ m, s, f }: { m: any; s: string; f: string }): Promise<{ valid: boolean; message: any; from?: string }> => {
        return {
            valid: await verifyMessage({
                address: f as `0x${string}`,
                message: m,
                signature: s as `0x${string}`
            }),
            message: m,
            from: f
        };
    };

    const handleSeal = async (message: string, targetPublicKey: string, useIdentityMode: boolean): Promise<string> => {
        if (!message.trim()) {
            setError('Enter a message');
            return '';
        }
        if (!targetPublicKey) {
            setError('Enter target public key');
            return '';
        }

        try {
            // If unlocked and using identity mode, pass the getter function
            // Otherwise, pass undefined for anonymous sealing
            const keyGetter = (unlocked && useIdentityMode) ? getPrivateKey : undefined;

            const sealed = await sealMessage(message, targetPublicKey, keyGetter);
            setError('');
            return sealed;
        } catch (err: any) {
            setError('Failed to seal: ' + err.message);
            return '';
        }
    };

    const handleUnseal = async (sealedMessage: string): Promise<UnsealedMessage | null> => {
        if (!unlocked || !sealedMessage.trim()) {
            setError('Unlock wallet and enter sealed message');
            return null;
        }

        try {
            const result = await unsealMessage(sealedMessage, getPrivateKey);
            setError('');
            return result;
        } catch (err: any) {
            setError('Failed to unseal: ' + err.message);
            return null;
        }
    };

    const handleReset = () => {
        removeKey();
        lock();
        setHasStoredKey(false);
    };

    const copyAddress = async () => {
        if (!address) return;
        try {
            await navigator.clipboard.writeText(address);
        } catch { }
    };

    const copyPublicKey = async () => {
        if (!publicKey) return;
        try {
            await navigator.clipboard.writeText(publicKey);
        } catch { }
    };

    const handleFileSelect = async (file: File | null) => {
        if (!file) return;
        try {
            const text = await file.text();
            const key = text.trim();
            if (!key.startsWith('0x') || key.length !== 66) throw new Error('Invalid format');
            const newPin = prompt('Enter a 4-digit PIN:');
            if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) throw new Error('Invalid PIN');
            await saveEncryptedKey(key as `0x${string}`, newPin);
            setHasStoredKey(true);

            setError('');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const walletState: WalletState = {
        unlocked,
        address,
        publicKey,
        showPinInput,
        error
    };

    const contextValue: ToyWalletContextType = {
        walletState,
        unlock,
        lock,
        getPrivateKey,
        handleSign,
        handleSeal,
        handleUnseal,
        handleVerify,
        handleReset,
        copyAddress,
        copyPublicKey,
        handleFileSelect,
        setShowPinInput,
        setError,
        keyExists: () => hasStoredKey
    };

    return (
        <ToyWalletContext.Provider value={contextValue}>
            {children}
        </ToyWalletContext.Provider>
    );
}

// ==================== CUSTOM HOOK ====================
export function useToyWallet() {
    const context = useContext(ToyWalletContext);
    if (!context) {
        throw new Error('useToyWallet must be used within a ToyWalletProvider');
    }
    return context;
}

// ==================== WALLET UI COMPONENT ====================
export function ToyWallet() {
    const {
        walletState,
        unlock,
        lock,
        copyPublicKey,
        setShowPinInput,
        setError,
        keyExists
    } = useToyWallet();

    const { unlocked, publicKey, showPinInput, error } = walletState;

    const [pinInput, setPinInput] = useState('');
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

    const handlePinChange = (value: string) => {
        const sanitized = value.replace(/\D/g, '').slice(0, 4);
        setPinInput(sanitized);
        if (error) setError('');

        if (sanitized.length === 4) {
            setTimeout(() => {
                unlock(sanitized);
                setPinInput('');
            }, 100);
        }
    };

    const handleCopyPublicKey = async () => {
        await copyPublicKey();
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    return (
        <div className="flex items-center justify-center">
            <div className={`bg-gray-800/20 border rounded-full p-0.5 px-2 flex items-center space-x-3 min-w-0 ${showPinInput ? 'ring-2 ring-blue-400' : ''} transition-all`}>
                <button
                    onClick={() => {
                        if (unlocked) {
                            lock();
                        } else {
                            setShowPinInput(!showPinInput);
                            setPinInput('');
                            setError('');
                        }
                    }}
                    className="text-xl hover:scale-110 transition-transform cursor-pointer flex items-center"
                    title={unlocked ? "Lock wallet" : "Unlock wallet"}
                >
                    {unlocked ? "🔓" : "🔒"}
                    {(keyExists() || showPinInput) ? "" : <div className="text-sm px-2">set a pin!</div>}
                </button>

                {unlocked ? (
                    <>
                        <button
                            onClick={handleCopyPublicKey}
                            className="text-white text-sm font-mono truncate max-w-64 hover:text-blue-300 transition-colors cursor-pointer"
                            title="Copy public key"
                        >
                            {copyFeedback ? 'Copied!' : formatPublicKeyShort(publicKey)}
                        </button>
                    </>
                ) : showPinInput ? (
                    <form
                        className="flex items-center space-x-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (pinInput.length === 4) unlock(pinInput);
                        }}
                    >
                        <input
                            type="password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            value={pinInput}
                            onChange={(e) => handlePinChange(e.target.value)}
                            className="bg-transparent text-white text-center text-sm font-mono border border-gray-600 rounded px-1 pt-1 w-16 focus:outline-none focus:border-blue-400"
                            maxLength={4}
                            placeholder="****"
                            autoFocus
                        />
                        {error && <span className="text-red-400 text-xs">❌</span>}
                    </form>
                ) : null}

                {(unlocked || showPinInput) && <button
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    className="text-white hover:text-blue-300 transition-colors cursor-pointer ml-2"
                    title="Toggle debug panel"
                >
                    ⚙️
                </button>}
            </div>

            {showDebugPanel && (
                <ToyWalletDebug onClose={() => setShowDebugPanel(false)} />
            )}
        </div>
    );
}
