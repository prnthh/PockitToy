import { CartridgeWrapper } from "./MockApps";

function Game() {
    return (
        <CartridgeWrapper className="bg-red-500 shadow-[inset_-2px_2px_6px_rgba(255,255,255,1),inset_2px_-2px_6px_-1px_rgba(0,0,0,0.8)] rounded-4xl p-4 pt-2 min-w-[200px]">
            <span className='text-slate-700 italic text-xl font-bold'>Cheese Blaster</span>
            <div className="flex flex-col items-center space-x-2 bg-slate-200 w-full grow rounded-xl shadow-[inset_0px_0px_6px_0px_#000000]">
            </div>
        </CartridgeWrapper>
    );
}

export default Game;