import { useEffect, useRef } from 'react';
import { getRandomColorPalette } from './styleUtils';


declare global {
    interface Window {
        GlslCanvas: any;
    }
}


export const SkyShader = () => {
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

const DrawingCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);
    const animationFrameRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Store all drawn strokes for animation
        const strokes: Array<{ points: { x: number, y: number, time: number }[], complete: boolean }> = [];
        let currentStroke: { x: number, y: number, time: number }[] = [];

        // Select random palette
        const palette = getRandomColorPalette();

        // Resize canvas to fill screen
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation loop for dancing effect
        const animate = () => {
            // Fill background with palette color
            ctx.fillStyle = palette.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const currentTime = Date.now();

            // Draw all strokes with dancing effect
            strokes.forEach((stroke, strokeIndex) => {
                if (stroke.points.length < 2) return;

                ctx.strokeStyle = palette.stroke;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();

                for (let i = 0; i < stroke.points.length - 1; i++) {
                    const point1 = stroke.points[i];
                    const point2 = stroke.points[i + 1];

                    // Add dancing effect based on time and position
                    const waveOffset1 = Math.sin((currentTime * 0.002) + (point1.x * 0.01) + (strokeIndex * 0.5)) * 2;
                    const waveOffset2 = Math.sin((currentTime * 0.002) + (point2.x * 0.01) + (strokeIndex * 0.5)) * 2;

                    const x1 = point1.x + waveOffset1;
                    const y1 = point1.y + Math.cos((currentTime * 0.003) + (point1.y * 0.01) + (strokeIndex * 0.3)) * 1.5;
                    const x2 = point2.x + waveOffset2;
                    const y2 = point2.y + Math.cos((currentTime * 0.003) + (point2.y * 0.01) + (strokeIndex * 0.3)) * 1.5;

                    if (i === 0) {
                        ctx.moveTo(x1, y1);
                    }
                    ctx.lineTo(x2, y2);
                }
                ctx.stroke();
            });

            // Draw current stroke being drawn (if any) - no animation while drawing
            if (currentStroke.length > 1) {
                ctx.strokeStyle = palette.stroke;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();

                for (let i = 0; i < currentStroke.length - 1; i++) {
                    const point1 = currentStroke[i];
                    const point2 = currentStroke[i + 1];

                    if (i === 0) {
                        ctx.moveTo(point1.x, point1.y);
                    }
                    ctx.lineTo(point2.x, point2.y);
                }
                ctx.stroke();
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        const getEventPos = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            let clientX: number, clientY: number;

            if (e instanceof TouchEvent) {
                const touch = e.touches[0] || e.changedTouches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            const pos = getEventPos(e);
            lastPos.current = pos;
            currentStroke = [{ x: pos.x, y: pos.y, time: Date.now() }];
        }

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing.current || !lastPos.current) return;
            e.preventDefault();
            const eventPos = getEventPos(e);

            // Add point to current stroke
            currentStroke.push({ x: eventPos.x, y: eventPos.y, time: Date.now() });
            lastPos.current = eventPos;
        }

        const stopDrawing = () => {
            if (isDrawing.current && currentStroke.length > 0) {
                strokes.push({ points: currentStroke, complete: true });
                currentStroke = [];
            }
            isDrawing.current = false;
            lastPos.current = null;
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);

        // Touch events for mobile
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        // Cleanup
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', resizeCanvas);
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        }
    }, []);

    return <canvas ref={canvasRef} className="fixed top-0 left-0 pointer-events-auto select-none absolute inset-0 w-full h-full" />;
};

export default DrawingCanvas;