"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

const SaveBlobContext = createContext<{
    saveBlob: (key: string, blob: Blob) => Promise<void>,
    getBlob: (key: string) => Promise<Blob | null>,
}>({
    saveBlob: async (key: string, blob: Blob) => { },
    getBlob: async (key: string) => null,
});

export const useSaveBlob = () => useContext(SaveBlobContext);

// Simple hash function for data integrity
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
};

export default function SaveBlobProvider({ children }: { children: React.ReactNode }) {
    const [blobs, setBlobs] = useState<Map<string, Blob>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    const saveBlob = async (key: string, blob: Blob) => {
        setBlobs(prev => new Map(prev).set(key, blob));
    };

    const getBlob = async (key: string) => {
        // Wait for initial load to complete
        if (!isLoaded) {
            return new Promise<Blob | null>((resolve) => {
                const checkLoaded = () => {
                    if (isLoaded) {
                        resolve(blobs.get(key) || null);
                    } else {
                        setTimeout(checkLoaded, 10);
                    }
                };
                checkLoaded();
            });
        }
        return blobs.get(key) || null;
    };

    // Load from storage
    useEffect(() => {
        const storedBlobs = localStorage.getItem('blobs');
        const storedHashes = localStorage.getItem('blobHashes');

        if (storedBlobs && storedHashes) {
            try {
                const blobData: { [key: string]: string } = JSON.parse(storedBlobs);
                const hashData: { [key: string]: string } = JSON.parse(storedHashes);
                const map = new Map<string, Blob>();

                for (const [key, base64Data] of Object.entries(blobData)) {
                    // Verify hash integrity
                    const expectedHash = simpleHash(base64Data);
                    const storedHash = hashData[key];

                    if (storedHash !== expectedHash) {
                        console.warn(`Hash mismatch for key "${key}", skipping`);
                        continue;
                    }

                    try {
                        const decodedData = atob(base64Data);
                        const blob = new Blob([decodedData]);
                        map.set(key, blob);
                    } catch (error) {
                        console.warn(`Failed to decode data for key "${key}":`, error);
                    }
                }

                setBlobs(map);
                console.log('Loaded blobs from storage:', map.size, 'items');
            } catch (error) {
                console.error('Failed to parse stored blobs:', error);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to storage
    useEffect(() => {
        if (!isLoaded) return;

        const saveToStorage = async () => {
            const blobData: { [key: string]: string } = {};
            const hashData: { [key: string]: string } = {};

            for (const [key, blob] of blobs) {
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const binaryString = String.fromCharCode(...uint8Array);
                    const base64Data = btoa(binaryString);
                    const hash = simpleHash(base64Data);

                    blobData[key] = base64Data;
                    hashData[key] = hash;
                } catch (error) {
                    console.warn(`Failed to serialize blob for key "${key}":`, error);
                }
            }

            localStorage.setItem('blobs', JSON.stringify(blobData));
            localStorage.setItem('blobHashes', JSON.stringify(hashData));
        };

        saveToStorage();
    }, [blobs, isLoaded]);

    return (
        <SaveBlobContext.Provider value={{ saveBlob, getBlob }}>
            {children}
        </SaveBlobContext.Provider>
    );
}
