export interface EthereumProvider {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (eventName: string, listener: (...args: any[]) => void) => void;
    removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
    isMetaMask?: boolean; //--> optional/in metaMask
    isCoinbaseWallet?: boolean; //--> optional/in coinbase wallet
    providers?: EthereumProvider[]; //--> optional/in Coinbase Wallet
    chainId?: string; //-->suggested by EIP-1193
}

import React, { useEffect, useRef } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { useToyWallet } from '../ToyWalletProvider';

declare global {
    interface Window {
        ethereum?: EthereumProvider | undefined;
    }
}

export interface EthereumProviderProps {
    children?: React.ReactNode;
    /** If true, replace any existing window.ethereum. Default: false (do not override existing provider). */
    force?: boolean;
    /** Initial accounts to expose */
    initialAccounts?: string[];
    /** Initial chain id in hex (e.g. '0x1') */
    initialChainId?: string;
    /** Optional RPC URL for the testnet provider. Defaults to sepolia RPC if omitted. */
    rpcUrl?: string;
    /** Optional subset of ToyWallet functions — pass `useToyWallet()` result from a parent to enable real wallet operations */
    wallet?: {
        getPrivateKey: () => Promise<`0x${string}` | null>;
        handleSign?: (message: string) => Promise<{ m: any; s: string; f: string } | null>;
        handleSeal?: (message: string, targetPublicKey: string, useIdentityMode: boolean) => Promise<string>;
        handleUnseal?: (sealedMessage: string) => Promise<{ message: string; from?: string } | null>;
        handleVerify?: (arg: any) => Promise<any>;
        keyExists?: () => boolean;
    };
}

// Minimal mock provider implementation that follows EIP-1193-ish surface.
function createViemBackedProvider(opts?: {
    rpcUrl?: string;
    initialChainId?: string;
    wallet?: EthereumProviderProps['wallet'];
}) {
    const rpcUrl = opts?.rpcUrl ?? 'https://eth.llamarpc.com';
    const wallet = opts?.wallet;

    // choose chain based on rpcUrl (simple heuristic: llama/mainnet => mainnet)
    const chain = rpcUrl.includes('llamarpc.com') || rpcUrl.includes('mainnet') ? mainnet : sepolia;

    // default chainId uses provided initialChainId or selected chain
    let chainId = opts?.initialChainId ?? `0x${chain.id.toString(16)}`;

    const listeners = new Map<string, Set<(...args: any[]) => void>>();

    function emit(eventName: string, ...args: any[]) {
        const set = listeners.get(eventName);
        if (!set) return;
        for (const fn of Array.from(set)) {
            try {
                fn(...args);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('ethereum provider listener error', err);
            }
        }
    }

    const provider: EthereumProvider & { __pockit?: boolean; isPockit?: boolean; providers?: EthereumProvider[]; providerMap?: Record<string, EthereumProvider> } = {
        // Generic flags — avoid wallet-specific branding
        isMetaMask: false,
        isCoinbaseWallet: false,
        isPockit: true,
        chainId,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
            // Handle account/signing RPCs via toy wallet when available;
            // otherwise forward RPCs to the network via viem public client.
            switch (method) {
                case 'eth_accounts':
                    if (wallet?.getPrivateKey) {
                        const key = await wallet.getPrivateKey();
                        if (key) {
                            const acct = privateKeyToAccount(key);
                            return [acct.address];
                        }
                        return [];
                    }
                    return [];
                case 'eth_chainId':
                    return chainId;
                case 'eth_requestAccounts':
                    if (wallet?.getPrivateKey) {
                        const key = await wallet.getPrivateKey();
                        if (key) {
                            const acct = privateKeyToAccount(key);
                            const arr = [acct.address];
                            emit('accountsChanged', arr.slice());
                            return arr;
                        }
                        return [];
                    }
                    return [];
                case 'personal_sign':
                case 'eth_sign':
                    try {
                        const p = params as any[] | undefined;
                        const message = p && p[0] ? String(p[0]) : '';
                        if (wallet?.handleSign) {
                            const res = await wallet.handleSign(message);
                            if (res && res.s) return res.s;
                        }
                        return Promise.reject(new Error('no wallet available to sign'));
                    } catch (err) {
                        return Promise.reject(err);
                    }
                case 'pockit_seal':
                    try {
                        const p = params as any[] | undefined;
                        const message = p && p[0] ? String(p[0]) : '';
                        const target = p && p[1] ? String(p[1]) : '';
                        const useIdentity = !!(p && p[2]);
                        if (wallet?.handleSeal) {
                            return await wallet.handleSeal(message, target, useIdentity);
                        }
                        return Promise.reject(new Error('no wallet available to seal'));
                    } catch (err) {
                        return Promise.reject(err);
                    }
                case 'pockit_unseal':
                    try {
                        const p = params as any[] | undefined;
                        const sealed = p && p[0] ? String(p[0]) : '';
                        if (wallet?.handleUnseal) {
                            return await wallet.handleUnseal(sealed);
                        }
                        return Promise.reject(new Error('no wallet available to unseal'));
                    } catch (err) {
                        return Promise.reject(err);
                    }
                case 'wallet_switchEthereumChain':
                    // We do not change the underlying RPC here — ask the caller to recreate provider with desired rpcUrl.
                    return Promise.reject(new Error('wallet_switchEthereumChain not supported by this provider; recreate provider with appropriate rpcUrl'));
                default:
                    // Forward other JSON-RPC methods to the network using a direct JSON-RPC POST to rpcUrl
                    try {
                        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] });
                        const resp = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
                        const json = await resp.json();
                        if (json.error) return Promise.reject(new Error(json.error.message || JSON.stringify(json.error)));
                        return json.result;
                    } catch (err) {
                        return Promise.reject(err);
                    }
            }
        },
        on: (eventName: string, listener: (...args: any[]) => void) => {
            let set = listeners.get(eventName);
            if (!set) {
                set = new Set();
                listeners.set(eventName, set);
            }
            set.add(listener);
        },
        removeListener: (eventName: string, listener: (...args: any[]) => void) => {
            const set = listeners.get(eventName);
            if (!set) return;
            set.delete(listener);
            if (set.size === 0) listeners.delete(eventName);
        },
    };

    // mark provider so we can detect it in the page
    (provider as any).__pockit = true;

    return provider;
}

/**
 * React component that installs a viem-backed Ethereum provider at window.ethereum on mount.
 * By default it will only set the provider if none exists. Pass `force` to override an existing provider.
 * On unmount it restores the previous value of window.ethereum.
 */
export default function EthereumProvider(props: EthereumProviderProps) {
    const { children, force = false, initialChainId, wallet, rpcUrl } = props;
    const originalRef = useRef<EthereumProvider | undefined>(undefined);

    useEffect(() => {
        // save original
        originalRef.current = window.ethereum;

        if (window.ethereum && !force) {
            // do not override an existing provider
            // eslint-disable-next-line no-console
            console.warn('window.ethereum already present — not overriding (pass force=true to override)');
            return () => {
                // nothing to cleanup because we didn't set
            };
        }

        const provider = createViemBackedProvider({ rpcUrl, initialChainId, wallet });
        // If an existing provider was present and we're forcing override, try to coexist.
        // Some wallets (Coinbase) expect window.ethereum.providers/providerMap to list multiple providers.
        if (force && originalRef.current) {
            try {
                const existing = originalRef.current as any;
                // Compose a providers array with the original and our new provider.
                provider.providers = [existing, provider];

                // Build a minimal providerMap. Prefer any existing providerMap entries.
                const map: Record<string, EthereumProvider> = {};
                if (existing && typeof existing === 'object') {
                    // Attempt to pick a human-friendly name from known flags.
                    const name = existing.isMetaMask ? 'MetaMask' : existing.isCoinbaseWallet ? 'Coinbase' : 'External';
                    map[name] = existing;
                }
                map.Pockit = provider;
                provider.providerMap = map;
            } catch (e) {
                // ignore failures — best-effort only
            }
        }

        // install the viem-backed provider
        window.ethereum = provider;

        return () => {
            // restore original provider
            window.ethereum = originalRef.current;
        };
    }, [force, initialChainId, wallet, rpcUrl]);

    return <>{children}</>;
}


export function EVMWrapper({ children }: { children?: React.ReactNode }) {
    const wallet = useToyWallet();

    // pass only the functions the provider needs
    const walletBridge = {
        getPrivateKey: wallet.getPrivateKey,
        handleSign: wallet.handleSign,
        handleSeal: wallet.handleSeal,
        handleUnseal: wallet.handleUnseal,
        keyExists: wallet.keyExists,
    };

    return (
        <EthereumProvider wallet={walletBridge} rpcUrl={'https://eth.llamarpc.com'} force={true}>
            {children}
        </EthereumProvider>
    );
}


export { createViemBackedProvider };

// helper to detect an EIP-1193-like provider and report basic capabilities.
export async function detectProvider(): Promise<{ present: boolean; supports: Record<string, boolean> }> {
    const methods = ['eth_accounts', 'eth_chainId'];
    if (typeof window.ethereum === 'undefined' || !window.ethereum) return { present: false, supports: {} };
    const ethereum = window.ethereum as EthereumProvider;
    const results: Record<string, boolean> = {};
    await Promise.all(
        methods.map((method) =>
            ethereum
                .request({ method })
                .then(() => {
                    results[method] = true;
                })
                .catch(() => {
                    results[method] = false;
                })
        )
    );
    return { present: true, supports: results };
}
