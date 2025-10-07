"use client";

import dynamic from 'next/dynamic';

const MPProvider = dynamic(() => import('./MP'), { ssr: false })

export default function PockitConsoleProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <MPProvider roomId="my-room-id">
                {children}
            </MPProvider>
        </>
    )
} 