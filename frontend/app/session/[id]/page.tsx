'use client';

import { Button, Code, Link } from '@nextui-org/react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function Page() {
    const [showLink, setShowLink] = useState(false);
    const sessionUrl = process.env.NEXT_PUBLIC_FRONTEND_URL + '/session/12345/client';

    return (
        <div className="flex flex-col items-center gap-6 p-8">
            <h1>Generated a new game session:</h1>

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