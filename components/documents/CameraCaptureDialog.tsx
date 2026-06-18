'use client';

/**
 * Phase 50 — In-browser camera capture.
 *
 * Opens the device camera via getUserMedia (works on desktop webcams AND mobile),
 * shows a live preview, and captures a still frame as a JPEG `File`. Used by the
 * per-item Documents upload so "Take photo" works everywhere — not only on phones
 * (the native `capture` input is mobile-only).
 *
 * @see components/documents/DocumentsSection.tsx
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

export interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the captured photo as a JPEG File. */
  onCapture: (file: File) => void;
}

export function CameraCaptureDialog({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setError(
          e instanceof Error && e.message === 'unsupported'
            ? "This browser can't open the camera. Use “Upload document” instead."
            : 'Could not access the camera. Check the browser camera permission and try again.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onOpenChange(false);
      },
      'image/jpeg',
      0.92,
    );
  }, [onCapture, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            Position the document in the frame, then capture.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-white/70">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <Button onClick={capture} disabled={!ready} className="gap-2">
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
