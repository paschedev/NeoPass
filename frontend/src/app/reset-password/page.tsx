'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

function ResetPasswordFromLink() {
  return <ResetPasswordForm token={useSearchParams().get('token')} />;
}

// Reset link page: public, reached from the recovery email.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordFromLink />
    </Suspense>
  );
}
