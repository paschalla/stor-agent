import { FolderOpen } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center min-h-[60vh]">
      <div className="bg-gray-100 p-6 rounded-full mb-6">
        <FolderOpen className="w-12 h-12 text-gray-400" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Storage Configured</h2>
      <p className="text-gray-500 max-w-md mb-8">
        Your dashboard is currently empty. Get started by adding a new storage connection or syncing your data.
      </p>
      <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-sm transition-colors cursor-pointer">
        Add Storage
      </button>
    </div>
  );
}
