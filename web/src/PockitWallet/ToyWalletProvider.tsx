import React, { useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, toHex } from "viem";
import ToyWalletDebug from "./ToyWalletDebug";
import * as secp from '@noble/secp256k1';

// ==================== SIMPLE UTILITIES ====================
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string) => new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));

function formatPublicKeyShort(pk?: string) {
    if (!pk || pk.length <= 24) return pk || '';
    return `${pk.slice(0, 10)}…${pk.slice(-6)}`;
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
        const account = privateKeyToAccount(senderPrivateKeyHex);
        senderPubKeyForEnvelope = account.publicKey;
        fromAddress = account.address;
    } else {
        // Anonymous seal: use ephemeral key
        const ephemeralKey = generatePrivateKey();
        senderPrivKey = hexToBytes(ephemeralKey);
        const ephemeralAccount = privateKeyToAccount(ephemeralKey);
        senderPubKeyForEnvelope = ephemeralAccount.publicKey;
        fromAddress = undefined;
    }

    // Get shared secret using secp256k1
    const sharedSecret = secp.getSharedSecret(senderPrivKey, recipientPubKey, false);
    const sharedKey = sharedSecret[0] === 4 ? sharedSecret.slice(1, 33) : sharedSecret.slice(0, 32);

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

interface UnsealedMessage {
    message: string;
    from?: string;
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
    const sharedSecret = secp.getSharedSecret(myPrivKey, senderPubKey, false);
    const sharedKey = sharedSecret[0] === 4 ? sharedSecret.slice(1, 33) : sharedSecret.slice(0, 32);

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
    localStorage.setItem('wallet', encrypted);
}

async function loadDecryptedKey(pin: string): Promise<`0x${string}` | null> {
    const stored = localStorage.getItem('wallet');
    if (!stored) return null;

    return await decryptPrivateKey(stored, pin);
}

function keyExists(): boolean {
    return !!localStorage.getItem('wallet');
}

function removeKey() {
    localStorage.removeItem('wallet');
}

// ==================== MAIN COMPONENT ====================
function ToyWallet() {
    const [currentPin, setCurrentPin] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [address, setAddress] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [showPinInput, setShowPinInput] = useState(false);
    const [error, setError] = useState('');

    // Minimal UI state
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

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
        const walletExists = keyExists();
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
            const pubKey = account.publicKey;

            setCurrentPin(pin);
            setAddress(account.address);
            setPublicKey(pubKey);
            setUnlocked(true);
            setShowPinInput(false);
        }
    };

    const lock = () => {
        setCurrentPin('');
        setAddress('');
        setPublicKey('');
        setUnlocked(false);
        setShowPinInput(false);
    };

    const handleSign = async (message: string, useIdentityMode: boolean) => {
        if (!unlocked || !message.trim()) {
            setError('Unlock wallet and enter a message');
            return '';
        }

        try {
            const privateKey = await getPrivateKey();
            if (!privateKey) {
                setError('Failed to get private key');
                return '';
            }

            let signingKey: `0x${string}`;
            let fromAddress: string | undefined;

            if (useIdentityMode) {
                // Use your real identity key
                signingKey = privateKey;
                const account = privateKeyToAccount(privateKey);
                fromAddress = account.address;
            } else {
                // Use ephemeral key (untraceable)
                signingKey = generatePrivateKey();
                fromAddress = undefined;
            }

            const account = privateKeyToAccount(signingKey);
            const sig = await account.signMessage({ message });

            // Create signed message envelope
            // If signed with identity, include 'f' (from) so recipient knows who signed it
            // If signed with ephemeral key, no 'f' field - signature is valid but untraceable
            const signedEnvelope = JSON.stringify({
                m: message,
                s: sig,
                ...(fromAddress && { f: fromAddress })
            });

            setError('');
            return signedEnvelope;
        } catch (err: any) {
            setError('Failed to sign: ' + err.message);
            return '';
        }
    };

    const handleSeal = async (message: string, targetPublicKey: string, useIdentityMode: boolean) => {
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

    const handleUnseal = async (sealedMessage: string) => {
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
    };

    const [pinInput, setPinInput] = useState('');

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

    const copyAddress = async () => {
        if (!address) return;
        try {
            await navigator.clipboard.writeText(address);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch { }
    };

    const copyPublicKey = async () => {
        if (!publicKey) return;
        try {
            await navigator.clipboard.writeText(publicKey);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch { }
    };

    return (
        <div className="flex items-center justify-center relative">
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
                    className="text-xl hover:scale-110 transition-transform cursor-pointer"
                    title={unlocked ? "Lock wallet" : "Unlock wallet"}
                >
                    {unlocked ? "🔓" : "🔒"}
                </button>

                {unlocked ? (
                    <>
                        <button
                            onClick={copyPublicKey}
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
                <ToyWalletDebug
                    walletState={{
                        unlocked,
                        account: address ? { address: address as `0x${string}` } : null,
                        pin: '',
                        showPinInput,
                        walletExists: keyExists()
                    }}
                    initialTargetPublicKey={publicKey}
                    error={error}
                    setError={setError}
                    handleCopyAddress={copyAddress}
                    handleCopyPrivateKey={async () => {
                        const privateKey = await getPrivateKey();
                        if (!privateKey) return;
                        try {
                            const blob = new Blob([privateKey], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'pockit.key';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            setCopyFeedback(true);
                            setTimeout(() => setCopyFeedback(false), 2000);
                        } catch { }
                    }}
                    handleSignMessage={handleSign}
                    handleCreateTestSeal={handleSeal}
                    handleUnsealMessage={handleUnseal}
                    handleFileSelect={async (file: File | null) => {
                        if (!file) return;
                        try {
                            const text = await file.text();
                            const key = text.trim();
                            if (!key.startsWith('0x') || key.length !== 66) throw new Error('Invalid format');
                            const newPin = prompt('Enter a 4-digit PIN:');
                            if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) throw new Error('Invalid PIN');
                            await saveEncryptedKey(key as `0x${string}`, newPin);
                            setError('');
                        } catch (err: any) {
                            setError(err.message);
                        }
                    }}
                    handleResetWallet={handleReset}
                    onClose={() => setShowDebugPanel(false)}
                />
            )}
        </div>
    );
}

export default ToyWallet;
