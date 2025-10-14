import { useRef, useEffect } from "react";
import MockContractReader2 from "@/PockitWallet/evm/ContractReader";
import Game from "./TestGame";
import FrameGame from "./FrameGame";



export function CartridgeWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
    // Let the cartridge size itself based on its content. Use inline-flex so the wrapper shrinks to fit.
    return <div style={{ scrollSnapAlign: 'center' }} className={`flex flex-col relative pointer-events-auto h-[200px] max-w-[96vw] noscrollbar z-[20] ${className}`}>
        {children}

        {/* ports */}
        <div className="absolute top-[100%] left-1/2 -translate-x-1/2">
            <div className="w-[22px] h-[12px] bg-gray-400 rounded-b" />
        </div>
    </div >
}

export default function EthereumCartridgeCarousel() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // compute padding so first/last items can be centered. Accepts children that may initially report 0 width.
        const recompute = () => {
            const first = container.children[0] as HTMLElement | undefined;
            const last = container.children[container.children.length - 1] as HTMLElement | undefined;

            const measureWidth = (el?: HTMLElement) => {
                if (!el) return 0;
                // prefer offsetWidth, but fall back to getBoundingClientRect which can be non-zero when offsetWidth is 0
                return el.offsetWidth || el.getBoundingClientRect().width || 0;
            };

            const leftPad = first ? Math.max(0, container.clientWidth / 2 - measureWidth(first) / 2) : 0;
            const rightPad = last ? Math.max(0, container.clientWidth / 2 - measureWidth(last) / 2) : 0;

            container.style.paddingLeft = `${leftPad}px`;
            container.style.paddingRight = `${rightPad}px`;
        };

        // initial compute
        recompute();

        // center the first child after padding applied
        const centerFirst = () => {
            const first = container.children[0] as HTMLElement | undefined;
            if (!first) return;
            const target = first.offsetLeft + (first.offsetWidth || first.getBoundingClientRect().width) / 2 - container.clientWidth / 2;
            const clamped = Math.max(0, Math.min(target, container.scrollWidth - container.clientWidth));
            container.scrollTo({ left: clamped, behavior: 'auto' });
        };

        centerFirst();

        // Watch for resizes of the container and its children. This helps when cartridges have unknown widths initially.
        const ro = new ResizeObserver(() => {
            recompute();
        });

        ro.observe(container);
        // observe children too so that when their content loads and width changes we recompute
        Array.from(container.children).forEach((c) => ro.observe(c as Element));

        const onWindowResize = () => recompute();
        window.addEventListener('resize', onWindowResize);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', onWindowResize);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className='h-[calc(100vh-240px-30px)] items-end justify-start pl-[200px] overflow-x-scroll noscrollbar bottom-[240px] pb-[30px] overflow-x-auto flex gap-x-8 z-[20]'
            style={{ scrollSnapType: 'x mandatory' }}
        >
            {[<Game />, <FrameGame />, <MockContractReader2
                contractAddress={'0x0000000000000000000000000000000000000000'}
                abi={[
                    {
                        type: 'function',
                        name: 'name',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'string' }],
                    },
                ]}
                functionName={'name'}
            />].map((Child, i) => (
                <div key={i} className="flex-shrink-0 scroll-mx-4" >
                    {Child}
                </div>
            ))}
        </div>
    );
}
