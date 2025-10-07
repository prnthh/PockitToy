"use client";

import React, { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";

interface AudioProviderProps {
    children: ReactNode;
}

interface AudioContextType {
    unlockAudio: () => Promise<void>;
    playSound: (url?: string) => Promise<void>;
    isUnlocked: boolean;
}

const AudioCtx = createContext<AudioContextType | undefined>(undefined);

export function useAudio() {
    const ctx = useContext(AudioCtx);
    if (!ctx) throw new Error("useAudio must be used within AudioProvider");
    return ctx;
}

export const AudioProvider = ({ children }: AudioProviderProps) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isUnlocked, setUnlocked] = useState(false);
    const bufferCache = useRef<{ [url: string]: AudioBuffer }>({});

    useEffect(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.AudioContext)();
        }
        return () => {
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    const unlockAudio = async () => {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended" && !isUnlocked) {
            try {
                await ctx.resume();
                setUnlocked(true);
            } catch (e) {
                console.error("Failed to unlock AudioContext", e);
            }
        }
    };

    const loadBuffer = async (url: string): Promise<AudioBuffer> => {
        if (bufferCache.current[url]) return bufferCache.current[url];
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!audioCtxRef.current) {
            throw new Error("AudioContext not initialized");
        }
        const buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
        bufferCache.current[url] = buffer;
        return buffer;
    };

    const playSound = async (url?: string) => {
        const soundUrl = url ?? "/sound/ding.mp3"; // default sound
        const ctx = audioCtxRef.current;
        if (!ctx) {
            console.warn("AudioContext not initialized");
            return;
        }
        if (!isUnlocked || ctx.state === "suspended") {
            await unlockAudio();
        }
        if (ctx.state !== "running") {
            console.warn("AudioContext could not be unlocked");
            return;
        }
        const buffer = await loadBuffer(soundUrl);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
    };

    return (
        <AudioCtx.Provider value={{ unlockAudio, playSound, isUnlocked }}>
            {children}
        </AudioCtx.Provider>
    );
};
