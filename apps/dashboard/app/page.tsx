'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    router.replace(session?.accessToken ? '/overview' : '/login');
  }, [router]);

  return null;
}
