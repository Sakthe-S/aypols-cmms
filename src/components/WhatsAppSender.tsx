'use client';

import { useEffect } from 'react';

export default function WhatsAppSender() {
  useEffect(() => {
    fetch('/api/whatsapp/send-pending', {
      method: 'POST',
      keepalive: true,
    }).catch(() => {
      // Delivery is best-effort; never break the UI on failure.
    });
  }, []);

  return null;
}