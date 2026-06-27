import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface QueuedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'error';
}

export default function Scan() {
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newQueuedImages = newFiles.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued' as const,
      }));
      setImages((prev) => [...prev, ...newQueuedImages]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAll = async () => {
    const queued = images.filter(img => img.status === 'queued' || img.status === 'error');
    if (queued.length === 0) return;

    setIsUploading(true);

    // Set all pending to uploading
    setImages(prev => prev.map(img => 
      queued.find(q => q.id === img.id) ? { ...img, status: 'uploading' } : img
    ));

    for (const image of queued) {
      try {
        const fileExt = image.file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${image.id}.${fileExt}`;
        const storageRef = ref(storage, `pending_scans/${fileName}`);
        
        await uploadBytes(storageRef, image.file);
        
        setImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, status: 'uploaded' } : img
        ));
      } catch (error) {
        console.error('Upload failed for', image.id, error);
        setImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    setIsUploading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return <Loader2 className="w-3 h-3 mr-1 animate-spin" />;
      case 'uploaded': return <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" />;
      case 'error': return <AlertCircle className="w-3 h-3 mr-1 text-red-400" />;
      default: return <ImageIcon className="w-3 h-3 mr-1" />;
    }
  };

  const queuedCount = images.filter(i => i.status === 'queued' || i.status === 'error').length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Batch Scanner</h2>
          <p className="text-gray-500">Capture items and receipts rapidly for upload.</p>
        </div>
        <button
          onClick={triggerCamera}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors cursor-pointer"
        >
          <Camera className="w-5 h-5 mr-2" />
          Capture Photo
        </button>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={handleCapture}
        />
      </div>

      {images.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="bg-blue-50 p-4 rounded-full mb-4">
            <Camera className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Ready to scan</h3>
          <p className="text-gray-500 mb-6">Tap capture to start scanning items and receipts.</p>
          <button
            onClick={triggerCamera}
            className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer"
          >
            Open Camera
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <span className="font-medium text-gray-700">Upload Queue ({images.length})</span>
            <button 
              onClick={handleUploadAll}
              disabled={isUploading || queuedCount === 0}
              className={`flex items-center text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                isUploading || queuedCount === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer'
              }`}
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><UploadCloud className="w-4 h-4 mr-2" /> Upload {queuedCount > 0 ? queuedCount : ''} Files</>
              )}
            </button>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <div key={image.id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-100">
                <img src={image.previewUrl} alt="Captured" className={`w-full h-full object-cover transition-opacity ${image.status === 'uploading' ? 'opacity-50' : ''}`} />
                {image.status !== 'uploading' && image.status !== 'uploaded' && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                    <button
                      onClick={() => removeImage(image.id)}
                      className="bg-white/20 hover:bg-white/40 p-1.5 rounded-full text-white backdrop-blur-sm cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-xs font-medium text-white px-2 py-0.5 rounded-full bg-black/40 flex items-center w-fit capitalize">
                    {getStatusIcon(image.status)}
                    {image.status}
                  </span>
                </div>
              </div>
            ))}
            <button
              onClick={triggerCamera}
              className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors aspect-square cursor-pointer"
            >
              <Camera className="w-6 h-6 mb-2" />
              <span className="text-sm font-medium">Add More</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
