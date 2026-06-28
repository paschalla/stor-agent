import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, X, Loader2, CheckCircle2, Mic, Send, Edit2, Plus, Tag, Trash2, Package } from 'lucide-react';
import { useStore, type InventoryItem } from '../lib/store';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadString } from 'firebase/storage';
import { app, storage } from '../lib/firebase';

interface QueuedItem {
  id: string;
  originalImage?: string;
  boundingBox?: [number, number, number, number];
  name: string;
  quantity: number;
  tags: string[];
  price?: number;
  isEditing: boolean;
  status: 'pending' | 'confirmed';
  source: 'camera' | 'text' | 'voice';
}

const SUGGESTED_TAGS = [
  'fasteners', 'screws', 'nails', 'lumber', 'electrical',
  'plumbing', 'paint', 'cleaning', 'safety', 'office', 'vehicle',
  'adhesive', 'fittings', 'insulation', 'concrete',
];

/** Simple client-side parser: "add 5 tubes of caulk" → { name, qty } */
function parseAddCommand(text: string): { name: string; quantity: number; tags: string[] } {
  const addMatch = text.match(/^add\s+(\d+)\s+(.+)/i);
  if (addMatch) {
    return { name: addMatch[2].trim(), quantity: parseInt(addMatch[1], 10), tags: [] };
  }
  // "add caulk" without quantity
  const simpleAdd = text.match(/^add\s+(.+)/i);
  if (simpleAdd) {
    return { name: simpleAdd[1].trim(), quantity: 1, tags: [] };
  }
  return { name: text.trim(), quantity: 1, tags: [] };
}

export default function Add() {
  const { addToInventory } = useStore();
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [inputText, setInputText] = useState('');

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // ─── Camera ────────────────────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraActive(true);
      // Wait for React to render the video element before setting the stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !cameraActive) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    // Compress to reasonable size
    const imageUrl = canvas.toDataURL('image/jpeg', 0.7);

    setPreviewImage(imageUrl);
    setTimeout(() => setPreviewImage(null), 1000);

    setIsProcessing(true);

    try {
      const fileName = `pending_scans/${crypto.randomUUID()}.jpg`;
      const storageRef = ref(storage, fileName);

      // Upload the base64 string to Cloud Storage which triggers the Gemini Function
      await uploadString(storageRef, imageUrl, 'data_url');

      // Ideally we would listen to a Firestore document created by the function
      // For now, we mimic the real call completing in the UI to give feedback
      setTimeout(() => {
        const newItem: QueuedItem = {
          id: crypto.randomUUID(),
          originalImage: imageUrl,
          boundingBox: [0.15, 0.1, 0.85, 0.9],
          name: 'Captured Item (Processing...)',
          quantity: 1,
          tags: [],
          isEditing: true,
          status: 'pending',
          source: 'camera',
        };
        setQueue(prev => [newItem, ...prev]);
        setIsProcessing(false);
      }, 1000);

    } catch (e) {
      console.error("Failed to upload image to storage", e);
      setIsProcessing(false);
      // Fallback
      const newItem: QueuedItem = {
        id: crypto.randomUUID(),
        originalImage: imageUrl,
        boundingBox: [0.15, 0.1, 0.85, 0.9],
        name: 'Captured Item',
        quantity: 1,
        tags: [],
        isEditing: true,
        status: 'pending',
        source: 'camera',
      };
      setQueue(prev => [newItem, ...prev]);
    }
  }, [cameraActive]);

  // ─── Voice ─────────────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      audioContextRef.current = new AudioContext();
      const analyser = audioContextRef.current.createAnalyser();
      const mic = audioContextRef.current.createMediaStreamSource(stream);
      analyser.fftSize = 1024;
      mic.connect(analyser);

      let silenceStart = Date.now();
      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 10) silenceStart = Date.now();
        else if (Date.now() - silenceStart > 5000) { stopRecording(); return; }
        requestAnimationFrame(checkSilence);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            
            const functions = getFunctions(app);
            const processAudioIntent = httpsCallable(functions, 'processAudioIntent');
            
            try {
              const result = await processAudioIntent({ 
                audio: base64data,
                mimeType: 'audio/webm'
              }) as { data: { intent: string, items: { name: string, quantity: number }[] } };
              
              const data = result.data;
              
              if (data.items && data.items.length > 0) {
                const newItems: QueuedItem[] = data.items.map((item: any) => ({
                  id: crypto.randomUUID(),
                  name: item.name,
                  quantity: item.quantity,
                  tags: [],
                  isEditing: true,
                  status: 'pending',
                  source: 'voice',
                }));
                setQueue(prev => [...newItems, ...prev]);
              } else {
                // Fallback if no items detected
                const newItem: QueuedItem = {
                  id: crypto.randomUUID(),
                  name: 'Voice Entry (Unrecognized)',
                  quantity: 1,
                  tags: [],
                  isEditing: true,
                  status: 'pending',
                  source: 'voice',
                };
                setQueue(prev => [newItem, ...prev]);
              }
            } catch (err) {
              console.error("Cloud function error:", err);
              // Fallback
              const newItem: QueuedItem = {
                id: crypto.randomUUID(),
                name: 'Voice Entry (Error)',
                quantity: 1,
                tags: [],
                isEditing: true,
                status: 'pending',
                source: 'voice',
              };
              setQueue(prev => [newItem, ...prev]);
            } finally {
              setIsProcessing(false);
            }
          };
        } catch (err) {
          console.error("Error processing audio blob", err);
          setIsProcessing(false);
        }

        stream.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) audioContextRef.current.close();
      };

      mediaRecorder.start();
      setIsRecording(true);
      requestAnimationFrame(checkSilence);
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  // ─── Text ──────────────────────────────────────────────────────────────────

  const processText = (text: string) => {
    const parsed = parseAddCommand(text);
    const newItem: QueuedItem = {
      id: crypto.randomUUID(),
      name: parsed.name,
      quantity: parsed.quantity,
      tags: parsed.tags,
      isEditing: false,
      status: 'pending',
      source: 'text',
    };
    setQueue(prev => [newItem, ...prev]);
  };

  // ─── Queue operations ─────────────────────────────────────────────────────

  const updateItem = (id: string, updates: Partial<QueuedItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };
  const removeItem = (id: string) => setQueue(prev => prev.filter(item => item.id !== id));
  const addTag = (id: string, tag: string) => {
    if (!tag.trim()) return;
    setQueue(prev => prev.map(item => {
      if (item.id === id && !item.tags.includes(tag.toLowerCase())) {
        return { ...item, tags: [...item.tags, tag.toLowerCase()] };
      }
      return item;
    }));
  };
  const removeTag = (id: string, tagToRemove: string) => {
    setQueue(prev => prev.map(item => item.id === id
      ? { ...item, tags: item.tags.filter(t => t !== tagToRemove) }
      : item
    ));
  };

  // ─── Review & Submit ──────────────────────────────────────────────────────

  const handleSubmit = () => {
    const items: InventoryItem[] = queue.map(q => ({
      id: q.id,
      name: q.name,
      quantity: q.quantity,
      tags: q.tags,
      price: q.price,
      image: q.originalImage,
      boundingBox: q.boundingBox,
      addedAt: Date.now(),
      source: q.source,
    }));
    addToInventory(items);
    setQueue([]);
    if (cameraActive) stopCamera();
  };

  const handleCancelQueue = () => {
    setQueue([]);
    setShowConfirmDiscard(false);
    if (cameraActive) stopCamera();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  return (
    <div className="flex flex-col h-full relative pb-20">
      <div className="mb-4">
        <h2 className="text-xl font-bold font-heading">Add to Inventory</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Photo, text, or voice.</p>
      </div>

      {/* ── Camera Section ── */}
      {!cameraActive ? (
        <button
          onClick={startCamera}
          className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl px-4 py-3 transition-colors cursor-pointer mb-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
            <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Open Camera</p>
            <p className="text-xs text-gray-400">Snap photos to identify items</p>
          </div>
        </button>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black mb-4 shrink-0" style={{ maxHeight: '200px' }}>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ maxHeight: '200px' }} />
          {previewImage && (
            <div className="absolute inset-0 z-10">
              <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          )}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          {/* Shutter button */}
          <button
            onClick={capturePhoto}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-[3px] border-gray-300 shadow-lg hover:scale-105 active:scale-90 transition-transform cursor-pointer z-10"
          />
          {/* Close camera */}
          <button
            onClick={stopCamera}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg z-10 cursor-pointer transition-colors"
          >
            <CameraOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Queue ── */}
      <div className="flex-1 overflow-y-auto space-y-2.5 mb-4">
        {queue.length === 0 && (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Items will appear here as you add them.
          </div>
        )}
        {queue.map((item) => (
          <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              {/* Thumbnail or letter avatar */}
              <div className="w-12 h-12 rounded-lg shrink-0 relative overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                {item.originalImage ? (
                  <>
                    <img src={item.originalImage} className="w-full h-full object-cover" alt="" />
                    {item.boundingBox && (
                      <div
                        className="absolute border-2 border-emerald-400 bg-emerald-400/15 rounded-sm"
                        style={{
                          top: `${item.boundingBox[0] * 100}%`,
                          left: `${item.boundingBox[1] * 100}%`,
                          height: `${(item.boundingBox[2] - item.boundingBox[0]) * 100}%`,
                          width: `${(item.boundingBox[3] - item.boundingBox[1]) * 100}%`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                {item.isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      className="w-full border-b border-gray-300 dark:border-gray-600 px-1 py-0.5 text-sm font-medium bg-transparent focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Qty:</span>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-14 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-0.5 text-xs bg-transparent"
                        min="1"
                      />
                      <span className="text-xs text-gray-400 ml-2">$</span>
                      <input
                        type="number"
                        value={item.price ?? ''}
                        onChange={(e) => updateItem(item.id, { price: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                        className="w-16 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-0.5 text-xs bg-transparent"
                        step="0.01"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      ×{item.quantity}
                      {item.price != null && <span className="ml-2">${item.price.toFixed(2)}</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {item.isEditing ? (
                  <button
                    onClick={() => updateItem(item.id, { isEditing: false, status: 'confirmed' })}
                    className="p-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer"
                    title="Confirm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                ) : item.status === 'confirmed' ? (
                  <>
                    <span className="text-emerald-500"><CheckCircle2 className="w-4 h-4" /></span>
                    <button
                      onClick={() => updateItem(item.id, { isEditing: true })}
                      className="p-3 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => updateItem(item.id, { status: 'confirmed' })}
                      className="p-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer"
                      title="Confirm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateItem(item.id, { isEditing: true })}
                      className="p-3 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-500 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors cursor-pointer"
                      title="Discard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3 h-3 text-gray-400" />
              {item.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 flex items-center gap-1">
                  {tag}
                  <button onClick={() => removeTag(item.id, tag)} className="p-2 -mr-2 hover:text-rose-500 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <div className="relative group/tag">
                <button className="w-8 h-8 rounded-md border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                  <Plus className="w-4 h-4" />
                </button>
                <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-2 hidden group-hover/tag:block z-20 max-h-36 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Type a tag…"
                    className="w-full text-xs px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-transparent mb-1.5 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        addTag(item.id, e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTED_TAGS.filter(t => !item.tags.includes(t)).slice(0, 10).map(st => (
                      <button
                        key={st}
                        onClick={() => addTag(item.id, st)}
                        className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom Bar: Text Input + Review/Cancel ── */}
      <div className="fixed bottom-14 left-0 right-0 z-20 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-lg border-t border-gray-200/60 dark:border-gray-800/60 px-4 py-2.5">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Text input */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden pr-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='try: "add 5 tubes of caulk"'
              className="flex-1 bg-transparent px-3.5 py-2 text-sm focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:italic"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText) {
                  processText(inputText);
                  setInputText('');
                }
              }}
            />
            {inputText ? (
              <button
                onClick={() => { processText(inputText); setInputText(''); }}
                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => isRecording ? stopRecording() : startRecording()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          {queue.length > 0 && (
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowConfirmDiscard(true)}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium cursor-pointer px-2 py-1"
              >
                Cancel ({queue.length})
              </button>
              <button
                onClick={handleSubmit}
                disabled={pendingCount === queue.length && queue.every(i => i.status === 'pending')}
                className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Review & Continue →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Discard confirmation dialog */}
      {showConfirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirmDiscard(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-xs text-center" onClick={e => e.stopPropagation()}>
            <p className="font-semibold mb-1">Discard {queue.length} queued item{queue.length !== 1 ? 's' : ''}?</p>
            <p className="text-sm text-gray-500 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmDiscard(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Go Back
              </button>
              <button onClick={handleCancelQueue} className="flex-1 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-rose-600 transition-colors">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
