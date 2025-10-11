export default function ConfigPage() {
    return <div className='w-full h-full flex flex-col items-start text-black p-4 overflow-y-auto noscrollbar text-black/80 font-medium'>
        <div className="text-left">
            Pockit Toy is a revolutionary communications device. <br /><br />
            Features:<br />
            - secp256k1 identity management<br />
            - peer-to-peer messaging<br />
            - public rooms<br />
            - ???<br />
        </div>
        <div className="bg-black/10 rounded-xl mt-4 self-center px-2">
            channel:
            my-room-id
        </div>
        {/* <div>
            Trusted domains: <br />
            pockit.world
            draw.pockit.world
        </div> */}
    </div>
}