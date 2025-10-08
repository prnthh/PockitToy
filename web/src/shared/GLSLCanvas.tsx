import { useEffect, useRef } from 'react';


declare global {
    interface Window {
        GlslCanvas: any;
    }
}


const SkyShader = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let resizeHandler: () => void;

        const initShader = () => {
            const canvas = canvasRef.current;
            if (!canvas || !window.GlslCanvas) {
                requestAnimationFrame(initShader);
                return;
            }

            // Resize canvas to fill screen
            resizeHandler = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            };
            window.addEventListener('resize', resizeHandler);
            resizeHandler();

            const frag = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;

float hash(vec2 p) {
return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

float noise(vec2 x) {
vec2 i = floor(x);
vec2 f = fract(x);
float a = hash(i);
float b = hash(i + vec2(1.0, 0.0));
float c = hash(i + vec2(0.0, 1.0));
float d = hash(i + vec2(1.0, 1.0));
vec2 u = f * f * (3.0 - 2.0 * f);
return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
float value = 0.0;
float amp = 0.5;
for (int i = 0; i < 5; i++) {
value += amp * noise(p);
p *= 1.5;
amp *= 0.5;
}
return value;
}

void main() {
vec2 st = gl_FragCoord.xy / u_resolution.xy;
st.x *= u_resolution.x / u_resolution.y;
vec2 pos = st * 3.0;
pos.x -= u_time * 0.2;
float n = fbm(pos);
vec3 sky = vec3(0.5, 0.7, 1.0);
vec3 cloud = vec3(1.0, 1.0, 1.0);
vec3 color = mix(sky, cloud, smoothstep(0.5, 0.7, n));
gl_FragColor = vec4(color, 1.0);
}
`;

            const gl = new window.GlslCanvas(canvas);
            gl.load(frag);
        };

        // Load script if not loaded
        if (!window.GlslCanvas) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/patriciogonzalezvivo/glslCanvas@master/dist/GlslCanvas.js';
            script.onload = () => initShader();
            document.head.appendChild(script);
        } else {
            initShader();
        }

        // Cleanup
        return () => {
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
            }
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed top-0 left-0 pointer-events-none select-none absolute inset-0 w-full h-[108vh]" />;
};

export default SkyShader;