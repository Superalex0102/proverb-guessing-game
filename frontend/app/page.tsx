'use client';

import { Button, Link } from '@nextui-org/react';

export default function Page() {
  return (
    <div>
      <h1>Hello, welcome to Proverb Guessing Game!</h1>
      <Button
        as={Link}
        href="/session/12345"
        color="primary"
      >Generate a QR Code on TV</Button>
    </div>
  );
}