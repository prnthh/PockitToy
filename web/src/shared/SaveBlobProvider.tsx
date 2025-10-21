"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import localforage from 'localforage';

interface SaveBlobContextType {
    data: Record<string, any>;
    // direct stores
    profile: Record<string, any>;
    setProfile: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    addressBook: Record<string, any>;
    setAddressBook: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    isLoaded: boolean;
}

const SaveBlobContext = createContext<SaveBlobContextType>({
    data: {},
    profile: {},
    setProfile: () => { },
    addressBook: {},
    setAddressBook: () => { },
    isLoaded: false,
});

export const useSaveBlob = () => useContext(SaveBlobContext);

export default function SaveBlobProvider({ children }: { children: ReactNode }) {
    // create separate stores for profile and addressBook
    const profileStore = localforage.createInstance({ name: 'pockit_store', storeName: 'profile' });
    const addressStore = localforage.createInstance({ name: 'pockit_store', storeName: 'addressBook' });

    // state starts empty; we'll load from async storage on mount
    const [profile, setProfile] = useState<Record<string, any>>({});
    const [addressBook, setAddressBook] = useState<Record<string, any>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    // Load both stores once on mount
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const [p, a] = await Promise.all([
                    profileStore.getItem<Record<string, any>>('value'),
                    addressStore.getItem<Record<string, any>>('value')
                ]);
                if (!mounted) return;
                if (p && typeof p === 'object') setProfile(p as Record<string, any>);
                if (a && typeof a === 'object') setAddressBook(a as Record<string, any>);
            } catch (e) {
                // ignore
            } finally {
                if (mounted) setIsLoaded(true);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    // Persist profile
    useEffect(() => {
        if (!isLoaded) return;
        profileStore.setItem('value', profile).catch(() => { /* ignore */ });
    }, [profile, isLoaded]);

    // Persist address book
    useEffect(() => {
        if (!isLoaded) return;
        addressStore.setItem('value', addressBook).catch(() => { /* ignore */ });
    }, [addressBook, isLoaded]);

    // Composite data view for compatibility with existing code that expects { profile, addressBook }
    const data = { profile, addressBook };

    return (
        <SaveBlobContext.Provider value={{ data, profile, setProfile, addressBook, setAddressBook, isLoaded }}>
            {children}
        </SaveBlobContext.Provider>
    );
}
