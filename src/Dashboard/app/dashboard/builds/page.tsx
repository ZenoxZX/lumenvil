'use client';

import { BuildList } from '@/components/BuildList';
import { NewBuildForm } from '@/components/NewBuildForm';

export default function BuildsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Builds</h1>
        <p className="text-muted-foreground">View and manage all builds</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <BuildList limit={20} />
        </div>
        <div>
          <NewBuildForm />
        </div>
      </div>
    </div>
  );
}
