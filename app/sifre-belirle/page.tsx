import { Suspense } from 'react';
import SifreFormu from '@/components/SifreFormu';

export const dynamic = 'force-dynamic';

export default function SifreBelirleSayfasi() {
  return (
    <Suspense fallback={null}>
      <SifreFormu />
    </Suspense>
  );
}
