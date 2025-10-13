"use client";

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SaveBlobContextType {
    useData: <T>(key: string, defaultValue: T) => readonly [T, (data: T | ((prev: T) => T)) => void];
    isLoaded: boolean;
}

const SaveBlobContext = createContext<SaveBlobContextType>({
    useData: () => [null as any, () => { }],
    isLoaded: false,
});

export const useSaveBlob = () => useContext(SaveBlobContext);

export default function SaveBlobProvider({ children }: { children: ReactNode }) {
    // Simple checksum used to detect corrupted/partial writes
    const checksum = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
        }
        return hash.toString(36);
    };

    // Initialize synchronously from localStorage to avoid a mount-time race
    const [data, setData] = useState<Map<string, any>>(() => {
        try {
            const stored = localStorage.getItem('reactive-data');
            if (stored) {
                const payload = JSON.parse(stored);
                if (payload.data && payload.checksum === checksum(payload.data)) {
                    return new Map(Object.entries(JSON.parse(payload.data)));
                } else {
                    localStorage.removeItem('reactive-data');
                }
            }
        } catch {
            // ignore parse/storage errors and remove the key if possible
            try { localStorage.removeItem('reactive-data'); } catch { /* ignore */ }
        }
        return new Map();
    });

    // Loaded synchronously
    const isLoaded = true;

    // Persist to localStorage whenever data changes
    useEffect(() => {
        if (!isLoaded) return;
        try {
            const dataStr = JSON.stringify(Object.fromEntries(data));
            const payload = { data: dataStr, checksum: checksum(dataStr) };
            localStorage.setItem('reactive-data', JSON.stringify(payload));
        } catch {
            // ignore storage errors (quota, serialization)
        }
    }, [data, isLoaded]);

    const useData = useCallback(function <T>(key: string, defaultValue: T) {
        const value = (data.get(key) ?? defaultValue) as T;
        const setValue = (newValue: T | ((prev: T) => T)) => {
            setData(prev => {
                const current = (prev.get(key) ?? defaultValue) as T;
                const final = typeof newValue === 'function' ? (newValue as Function)(current) : newValue;
                return new Map(prev).set(key, final);
            });
        };
        return [value, setValue] as const;
    }, [data]);

    // Merge updates from other tabs to avoid clobbering
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key !== 'reactive-data' || !e.newValue) return;
            try {
                const payload = JSON.parse(e.newValue);
                if (payload.data && payload.checksum === checksum(payload.data)) {
                    const incoming = new Map(Object.entries(JSON.parse(payload.data)));
                    setData(prev => {
                        // Merge, preferring in-memory values for existing keys
                        const merged = new Map(incoming);
                        for (const [k, v] of prev.entries()) merged.set(k, v);
                        return merged;
                    });
                }
            } catch {
                // ignore malformed payload
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    return (
        <SaveBlobContext.Provider value={{ useData, isLoaded }}>
            {children}
        </SaveBlobContext.Provider>
    );
}
