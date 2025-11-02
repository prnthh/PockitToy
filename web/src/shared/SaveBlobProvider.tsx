"use client";

import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ReactNode } from 'react';

interface SaveBlobContextType {
    data: Record<string, any>;
    setData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const SaveBlobContext = createContext<SaveBlobContextType>({
    data: {},
    setData: () => { },
});

export const useSaveBlob = () => {
    const { data, setData } = useContext(SaveBlobContext);

    const useData = <T,>(key: string, defaultValue: T): readonly [T, (newValue: T | ((prev: T) => T)) => void] => {
        const value = (data[key] ?? defaultValue) as T;

        const setValue = useMemo(() => (newValue: T | ((prev: T) => T)) => {
            setData(prevData => {
                const current = (prevData[key] ?? defaultValue) as T;
                const final = typeof newValue === 'function' ? (newValue as Function)(current) : newValue;
                return { ...prevData, [key]: final };
            });
        }, [key, defaultValue]);

        return [value, setValue] as const;
    };

    return { useData };
};

export default function SaveBlobProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useLocalStorage<Record<string, any>>('reactive-data', {});

    const contextValue = useMemo(() => ({ data, setData }), [data, setData]);

    return (
        <SaveBlobContext.Provider value={contextValue}>
            {children}
        </SaveBlobContext.Provider>
    );
}
