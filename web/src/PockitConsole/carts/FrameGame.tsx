import { useState } from "react";
import { CartridgeWrapper } from "./MockApps";

function Game() {
    const [url, setUrl] = useState("https://swap.cow.fi/");
    return (
        <CartridgeWrapper className="bg-blue-500 shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-4 pt-2 min-w-[400px] min-h-[400px]">
            <span className='text-slate-700 italic text-xl font-bold'>Browser</span>
            <div className="flex flex-col items-center space-x-2 bg-slate-200 w-full grow rounded-xl border shadow-[inset_0px_0px_6px_0px_#000000]">
                <iframe src={url} className="w-full h-full rounded-xl"></iframe>
            </div>
            <input type="text" defaultValue={url} onChange={(e) => setUrl(e.target.value)} className="mt-2 p-1 rounded w-full text-sm text-white font-medium" />
        </CartridgeWrapper>
    );
}

export default Game;