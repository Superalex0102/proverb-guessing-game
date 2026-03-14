'use client';

import { useEffect, useState } from "react";

export default function Page() {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'lobby' | 'picking' | 'constructing' | 'finished'>('lobby');

    const PICKING_TIME = 10000;
    const CONSTRUCTING_TIME = 120000;

    useEffect(() => {
        if (status === 'lobby' || status === 'finished') return;

        const duration = status === 'picking' ? PICKING_TIME : CONSTRUCTING_TIME;
        const startedAt = Date.now();

        setProgress(100);

        const interval = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const nextProgress = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(nextProgress);

            if (elapsed >= duration) {
                clearInterval(interval);
                if (status === 'picking') setStatus('constructing');
                else if (status === 'constructing') setStatus('finished');
            }
        }, 100);

        return () => {
            clearInterval(interval);
        };
    }, [status]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-6 w-full bg-slate-50">
            
            {/* 1. LOBBY */}
            {status === 'lobby' && (
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => setStatus('picking')}
                        style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '12px 24px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        START
                    </button>
                </div>
            )}

            {/* 2. PROGRESS BAR */}
            {(status === 'picking' || status === 'constructing') && (
                <div className="w-full max-w-2xl space-y-6">
                    <h2 className="text-2xl text-center font-semibold text-slate-700">
                        {status === 'picking' ? "Picking Proverb..." : "Construction in Progress..."}
                    </h2>

                    {/* The Track (Background) */}
                    <div
                        className="relative w-full h-6 bg-[#e0f2f1] rounded-full border border-teal-100 shadow-inner overflow-hidden"
                        style={{
                            height: '24px',
                            backgroundColor: '#e2e8f0',
                            border: '2px solid #334155',
                            borderRadius: '9999px',
                            overflow: 'hidden'
                        }}
                    >
                        {/* The Filling Bar */}
                        <div
                            className="h-full rounded-full transition-all ease-linear relative"
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                transition: 'width 100ms linear',
                                background: 'linear-gradient(to bottom, #4db6ac, #00796b)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                        >
                            {/* The Glossy Shine (The white streak from your image) */}
                            <div className="absolute top-[15%] left-[1%] w-[98%] h-[25%] bg-white/30 rounded-full" />
                        </div>
                    </div>
                </div>
            )}

            {/* 3. FINISHED */}
            {status === 'finished' && (
                <div className="text-center animate-appearance-in">
                    <h1 className="text-4xl font-bold text-teal-600">Finished!</h1>
                    <p className="mt-4 text-slate-600">The process is complete.</p>
                    <button
                        type="button"
                        onClick={() => setStatus('lobby')}
                        style={{
                            marginTop: '24px',
                            background: '#e2e8f0',
                            color: '#0f172a',
                            border: '1px solid #94a3b8',
                            borderRadius: '9999px',
                            padding: '10px 20px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Következő közmondás
                    </button>
                </div>
            )}
        </div>
    );
}