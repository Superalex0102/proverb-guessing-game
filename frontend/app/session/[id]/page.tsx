'use client';

import { Button, Code, Link } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function Page() {
    const params = useParams<{ id: string }>();
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [showLink, setShowLink] = useState(false);

    const sessionId = useMemo(() => {
        const value = params?.id;
        return Array.isArray(value) ? value[0] : value;
    }, [params]);

    const sessionUrl = useMemo(() => {
        if (!sessionId) return '';

        if (typeof window !== 'undefined') {
            return `${window.location.origin}/session/${sessionId}/client`;
        }

        return `${process.env.NEXT_PUBLIC_FRONTEND_URL}/session/${sessionId}/client`;
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setSessionExists(false);
            return;
        }

        let isCancelled = false;

        async function checkSession() {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (!isCancelled) {
                setSessionExists(response.ok);
            }
        }

        checkSession().catch(() => {
            if (!isCancelled) {
                setSessionExists(false);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [sessionId]);

    if (sessionExists === null) {
        return (
            <div className="flex min-h-screen items-center justify-center p-8">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                <h1 className="text-2xl font-semibold">Session not found</h1>
                <p>Please generate a new session from the home page.</p>
                <Link href="/">Go back</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 p-8">
            <h1>Generated a new game session: {sessionId}</h1>

            {/* The QR Code */}
            <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={sessionUrl} size={200} />
            </div>

            <div className="flex flex-col items-center gap-4">
                <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setShowLink(!showLink)}
                >
                    {showLink ? "Hide Link" : "Can't scan the QR code?"}
                </Button>

                {showLink && (
                    <div className="flex flex-col items-center gap-2 animate-appearance-in">
                        <p className="text-small text-default-500">Manual Link:</p>
                        <Link isExternal href={sessionUrl} showAnchorIcon>
                            <Code size="lg">{sessionUrl}</Code>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}