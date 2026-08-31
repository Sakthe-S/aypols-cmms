'use client';

import { useRef, type ReactNode } from 'react';

export default function ConfirmForm({
  action,
  message,
  children,
  className = '',
}: {
  action: (formData: FormData) => Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      action={action}
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
