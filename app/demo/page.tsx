import type { Metadata } from 'next';
import { DemoClient } from './demo-client';

export const metadata: Metadata = {
  title: 'Demo — VARkings',
  description: 'Demo estática de VARkings con datos de ejemplo, sin necesidad de registro.',
};

export default function DemoPage() {
  return <DemoClient />;
}
