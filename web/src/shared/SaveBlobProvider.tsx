"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const SaveBlobContext = createContext<{
    saveBlob: (key: string, blob: Blob) => Promise<void>,
    getBlob: (key: string) => Promise<Blob | null>,
    isLoaded: boolean,
    addToAddressBook: (walletAddress: string, name?: string) => Promise<boolean>,
    getAddressBook: () => Promise<Record<string, { name: string, addedAt: string }>>,
}>({
    saveBlob: async () => { },
    getBlob: async () => null,
    isLoaded: false,
    addToAddressBook: async () => false,
    getAddressBook: async () => ({}),
});

export const useSaveBlob = () => useContext(SaveBlobContext);

export default function SaveBlobProvider({ children }: { children: React.ReactNode }) {
    const [blobs, setBlobs] = useState<Map<string, Blob>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    const saveBlob = useCallback(async (key: string, blob: Blob) => {
        setBlobs(prev => new Map(prev).set(key, blob));
    }, []);

    const getBlob = useCallback(async (key: string): Promise<Blob | null> => {
        return isLoaded ? blobs.get(key) || null : null;
    }, [isLoaded, blobs]);

    const getAddressBook = useCallback(async (): Promise<Record<string, { name: string, addedAt: string }>> => {
        if (!isLoaded) return {};

        try {
            const blob = await getBlob('addressbook');
            if (!blob) return {};

            const text = await blob.text();
            const data = JSON.parse(text);
            return (data && typeof data === 'object') ? data : {};
        } catch {
            return {};
        }
    }, [isLoaded, getBlob]);

    const addToAddressBook = useCallback(async (walletAddress: string, name?: string): Promise<boolean> => {
        if (!isLoaded || !walletAddress) return false;

        try {
            const addressBook = await getAddressBook();
            addressBook[walletAddress] = {
                name: name || addressBook[walletAddress]?.name || walletAddress.slice(0, 8),
                addedAt: addressBook[walletAddress]?.addedAt || new Date().toISOString(),
            };

            await saveBlob('addressbook', new Blob([JSON.stringify(addressBook)], { type: 'application/json' }));
            return true;
        } catch {
            return false;
        }
    }, [isLoaded, getAddressBook, saveBlob]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('blobs');
            if (stored) {
                const data: Record<string, string> = JSON.parse(stored);
                const map = new Map<string, Blob>();

                Object.entries(data).forEach(([key, base64]) => {
                    try {
                        const binary = atob(base64);
                        map.set(key, new Blob([binary]));
                    } catch {
                        console.warn(`Failed to decode blob: ${key}`);
                    }
                });

                setBlobs(map);
            }
        } catch {
            console.warn('Failed to load blobs from localStorage');
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage when blobs change
    useEffect(() => {
        if (!isLoaded) return;

        const saveToStorage = async () => {
            const data: Record<string, string> = {};

            for (const [key, blob] of blobs) {
                try {
                    const buffer = await blob.arrayBuffer();
                    const binary = String.fromCharCode(...new Uint8Array(buffer));
                    data[key] = btoa(binary);
                } catch {
                    console.warn(`Failed to serialize blob: ${key}`);
                }
            }

            localStorage.setItem('blobs', JSON.stringify(data));
        };

        saveToStorage();
    }, [blobs, isLoaded]);

    return (
        <SaveBlobContext.Provider value={{ saveBlob, getBlob, isLoaded, addToAddressBook, getAddressBook }}>
            {children}
        </SaveBlobContext.Provider>
    );
}
