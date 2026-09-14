"use client";
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { useSocialText } from './common';
import type { Attachment } from './media';
export function useChatMedia(roomId: string, onChange: (file: Attachment | null) => void, onBusy: (busy: boolean) => void) {
const t = useSocialText();
  const input = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;

  return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function upload(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t("Максимум 15 МБ", "Ең көбі 15 МБ"));
      return;
    }
    setUploading(true);
    onBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await api<Attachment>(`/social/rooms/${roomId}/media`, {
        method: "POST",
        formData: data,
      });
      if (alive.current) onChange(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (alive.current) {
        setUploading(false);
        onBusy(false);
      }
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error(
        t(
          "Голосовые недоступны в этом браузере. Прикрепите аудиофайл.",
          "Бұл браузерде дауыс жазу қолжетімсіз. Аудиофайл тіркеңіз.",
        ),
      );
      return;
    }
    onBusy(true);
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        tracks.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = tracks;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const instance = new MediaRecorder(
        tracks,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = instance;
      const chunks: Blob[] = [];
      let bytes = 0;
      instance.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > 14 * 1024 * 1024 && instance.state === "recording")
            instance.stop();
        }
      };
      instance.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        tracks.getTracks().forEach((track) => track.stop());
        if (!alive.current) return;
        setRecording(false);
        onBusy(false);
        const blob = new Blob(chunks, { type: instance.mimeType });
        if (blob.size)
          void upload(
            new File(
              [blob],
              `voice-${Date.now()}.${instance.mimeType.includes("mp4") ? "m4a" : instance.mimeType.includes("ogg") ? "ogg" : "webm"}`,
              { type: instance.mimeType },
            ),
          );
      };
      instance.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 180000);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      onBusy(false);
      toast.error(
        t(
          "Разрешите доступ к микрофону, чтобы записать голосовое.",
          "Дауыс жазу үшін микрофонға рұқсат беріңіз.",
        ),
      );
    }
  }

return { input, recording, uploading, upload, record };
}
