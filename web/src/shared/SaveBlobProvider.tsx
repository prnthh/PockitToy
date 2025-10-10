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
    const [data, setData] = useState<Map<string, any>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    // Simple checksum
    const checksum = useCallback((str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
        }
        return hash.toString(36);
    }, []);

    // Load on mount
    useEffect(() => {
        const stored = localStorage.getItem('reactive-data');
        if (stored) {
            try {
                const payload = JSON.parse(stored);
                if (payload.data && payload.checksum === checksum(payload.data)) {
                    setData(new Map(Object.entries(JSON.parse(payload.data))));
                } else {
                    localStorage.removeItem('reactive-data');
                }
            } catch {
                localStorage.removeItem('reactive-data');
            }
        }
        setIsLoaded(true);
    }, [checksum]);

    // Save on change
    useEffect(() => {
        if (!isLoaded) return;
        const dataStr = JSON.stringify(Object.fromEntries(data));
        const payload = { data: dataStr, checksum: checksum(dataStr) };
        localStorage.setItem('reactive-data', JSON.stringify(payload));
    }, [data, isLoaded, checksum]);

    const useData = useCallback(function <T>(key: string, defaultValue: T) {
        const value = data.get(key) ?? defaultValue;
        const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
            setData(prev => {
                const current = prev.get(key) ?? defaultValue;
                const final = typeof newValue === 'function' ? (newValue as Function)(current) : newValue;
                return new Map(prev).set(key, final);
            });
        }, [key]);
        return [value, setValue] as const;
    }, [data]);

    return (
        <SaveBlobContext.Provider value={{ useData, isLoaded }}>
            {children}
        </SaveBlobContext.Provider>
    );
}
