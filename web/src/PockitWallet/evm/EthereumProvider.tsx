export interface EthereumProvider {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (eventName: string, listener: (...args: any[]) => void) => void;
    removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
    isMetaMask?: boolean; //--> optional/in metaMask
    isCoinbaseWallet?: boolean; //--> optional/in coinbase wallet
    providers?: EthereumProvider[]; //--> optional/in Coinbase Wallet
    chainId?: string; //-->suggested by EIP-1193
}

// bad news: this will not replace window.ethereum in all contexts (e.g. iframes) due to CSP restrictions.
// this can only be fixed by the child page handling messages from the parent context or by using a browser extension.
// but it will work in most cases, and we also set window.pockit and window.walletRouter for direct access.

import React, { useEffect, useRef, useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { createWalletClient, createPublicClient, http } from 'viem';
import { useToyWallet } from '../ToyWalletProvider';
import { announceProvider } from 'mipd';

const EthereumContext = React.createContext<{ provider: EthereumProvider | null; client: any; chainId: string; setChainId: (id: string) => void } | null>(null);

export const useEthereum = () => {
    const context = React.useContext(EthereumContext);
    if (!context) throw new Error('useEthereum must be used within EthereumProvider');
    return context;
};

declare global {
    interface Window {
        ethereum?: EthereumProvider | undefined;
        pockit?: EthereumProvider;
        walletRouter?: {
            pockitProvider: EthereumProvider;
            lastInjectedProvider?: EthereumProvider;
            currentProvider: EthereumProvider;
            providers: EthereumProvider[];
            setDefaultProvider: (pockitAsDefault: boolean) => void;
            addProvider: (provider: EthereumProvider) => void;
        };
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
async function createViemBackedProvider(opts?: {
    rpcUrl?: string;
    initialChainId?: string;
    wallet?: EthereumProviderProps['wallet'];
}): Promise<{ provider: EthereumProvider; client: any }> {
    const rpcUrl = opts?.rpcUrl ?? 'https://eth.llamarpc.com';
    const wallet = opts?.wallet;

    // choose chain based on rpcUrl (simple heuristic: llama/mainnet => mainnet)
    const chain = rpcUrl.includes('llamarpc.com') || rpcUrl.includes('mainnet') ? mainnet : sepolia;

    // default chainId uses provided initialChainId or selected chain
    let chainId = opts?.initialChainId ?? `0x${chain.id.toString(16)}`;

    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl)
    });

    if (wallet?.getPrivateKey) {
        // Create and return viem wallet client directly, with custom overrides for pockit methods
        const key = await wallet.getPrivateKey();
        if (key) {
            const account = privateKeyToAccount(key);
            const walletClient = createWalletClient({
                account,
                chain,
                transport: http(rpcUrl)
            });

            // Add custom properties
            (walletClient as any).isPockit = true;
            (walletClient as any).isMetaMask = false;
            (walletClient as any).isCoinbaseWallet = false;
            (walletClient as any).chainId = chainId;

            // Override request to handle custom pockit methods
            const originalRequest = (walletClient as any).request.bind(walletClient);
            (walletClient as any).request = async ({ method, params }: { method: string; params?: unknown[] }) => {
                if (method === 'pockit_seal') {
                    const p = params as any[] | undefined;
                    const message = p && p[0] ? String(p[0]) : '';
                    const target = p && p[1] ? String(p[1]) : '';
                    const useIdentity = !!(p && p[2]);
                    if (wallet?.handleSeal) {
                        return await wallet.handleSeal(message, target, useIdentity);
                    }
                    return Promise.reject(new Error('no wallet available to seal'));
                } else if (method === 'pockit_unseal') {
                    const p = params as any[] | undefined;
                    const sealed = p && p[0] ? String(p[0]) : '';
                    if (wallet?.handleUnseal) {
                        return await wallet.handleUnseal(sealed);
                    }
                    return Promise.reject(new Error('no wallet available to unseal'));
                } else {
                    return originalRequest({ method: method as any, params: params as any });
                }
            };

            return { provider: walletClient as EthereumProvider, client: walletClient };
        }
    }

    // Fallback read-only provider using public client
    (publicClient as any).isPockit = true;
    (publicClient as any).isMetaMask = false;
    (publicClient as any).isCoinbaseWallet = false;
    (publicClient as any).chainId = chainId;

    return { provider: publicClient as EthereumProvider, client: publicClient };
}

/**
 * React component that installs a viem-backed Ethereum provider at window.ethereum on mount.
 * By default it will only set the provider if none exists. Pass `force` to override an existing provider.
 * On unmount it restores the previous value of window.ethereum.
 */
export default function EthereumProvider(props: EthereumProviderProps) {
    const { children, force = true, initialChainId, wallet, rpcUrl } = props;
    const originalRef = useRef<EthereumProvider | undefined>(undefined);
    const [chainId, setChainId] = useState(initialChainId || '0x1');
    const [provider, setProvider] = useState<EthereumProvider | null>(null);
    const [client, setClient] = useState<any>(null);

    useEffect(() => {
        // save original
        originalRef.current = window.ethereum;

        (async () => {
            const { provider: ethProvider, client: viemClient } = await createViemBackedProvider({ rpcUrl, initialChainId: chainId, wallet });
            setProvider(ethProvider);
            setClient(viemClient);

            // Announce the provider
            announceProvider({
                info: {
                    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzAwMEZGRiIvPgo8L3N2Zz4=', // TODO: add proper icon
                    name: 'Pockit',
                    rdns: 'me.pockit',
                    uuid: crypto.randomUUID(),
                },
                provider: ethProvider as any, // assuming it matches EIP1193Provider
            });

            // Set up window properties
            window.pockit = ethProvider;

            window.walletRouter = {
                pockitProvider: ethProvider,
                lastInjectedProvider: originalRef.current,
                currentProvider: ethProvider,
                providers: [ethProvider, ...(originalRef.current ? [originalRef.current] : [])],
                setDefaultProvider: (pockitAsDefault: boolean) => {
                    if (pockitAsDefault) {
                        window.walletRouter!.currentProvider = window.pockit!;
                    } else {
                        const nonDefault = window.walletRouter!.lastInjectedProvider ?? (window.ethereum as EthereumProvider);
                        window.walletRouter!.currentProvider = nonDefault;
                    }
                },
                addProvider: (prov: EthereumProvider) => {
                    if (!window.walletRouter!.providers.includes(prov)) {
                        window.walletRouter!.providers.push(prov);
                    }
                    if (ethProvider !== prov) {
                        window.walletRouter!.lastInjectedProvider = prov;
                    }
                },
            };

            // Define window.ethereum as getter/setter
            Object.defineProperties(window, {
                ethereum: {
                    get() {
                        return window.walletRouter?.currentProvider;
                    },
                    set(newProvider) {
                        window.walletRouter?.addProvider(newProvider);
                    },
                    configurable: true,
                },
            });

            // Set providers on the provider
            window.pockit!.providers = window.walletRouter.providers;

            // Dispatch initialized event
            window.dispatchEvent(new Event('ethereum#initialized'));
        })();

        return () => {
            // restore original
            if (originalRef.current) {
                window.ethereum = originalRef.current;
            } else {
                delete window.ethereum;
            }
            // Clean up
            delete window.pockit;
            delete window.walletRouter;
        };
    }, [force, chainId, wallet, rpcUrl]); return <EthereumContext.Provider value={{ provider, client, chainId, setChainId }}>{children}</EthereumContext.Provider>;
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
