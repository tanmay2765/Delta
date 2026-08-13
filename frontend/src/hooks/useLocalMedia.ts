import { useCallback, useEffect, useRef, useState } from "react";
import {
  consumeSharedMediaStream,
  peekSharedMediaStream,
  setSharedMediaStream,
} from "@/lib/shared-media";

export function useLocalMedia(initialCameraOn = true, initialMicOn = true) {
  const [cameraOn, setCameraOn] = useState(initialCameraOn);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [stream, setStream] = useState<MediaStream | null>(() => peekSharedMediaStream());
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const streamRef = useRef<MediaStream | null>(peekSharedMediaStream());
  const cameraStreamRef = useRef<MediaStream | null>(peekSharedMediaStream());

  const adoptStream = useCallback((media: MediaStream) => {
    media.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
    media.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
    streamRef.current = media;
    cameraStreamRef.current = media;
    setSharedMediaStream(media);
    setStream(media);
    return media;
  }, [cameraOn, micOn]);

  useEffect(() => {
    const transferred = consumeSharedMediaStream();
    if (transferred) {
      adoptStream(transferred);
    }
  }, [adoptStream]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cameraStreamRef.current = null;
    setSharedMediaStream(null);
    setStream(null);
  }, []);

  const requestAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera and microphone are not supported in this browser.");
      return null;
    }

    if (streamRef.current?.active) {
      return streamRef.current;
    }

    setIsRequesting(true);
    setError(null);

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return adoptStream(media);
    } catch {
      setError(
        "Could not access camera or microphone. Click Allow in the browser prompt, or check site permissions in your browser settings.",
      );
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [adoptStream]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
  }, [cameraOn]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [micOn]);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach((track) => track.stop());
      }
      const audioTracks = streamRef.current?.getAudioTracks() ?? [];
      const combined = new MediaStream([...screen.getVideoTracks(), ...audioTracks]);
      streamRef.current = combined;
      setSharedMediaStream(combined);
      setStream(combined);
      setSharing(true);
      screen.getVideoTracks()[0]?.addEventListener("ended", () => {
        void stopScreenShare();
      });
      return combined;
    } catch {
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!cameraStreamRef.current && !sharing) return;
    setSharing(false);
    if (cameraStreamRef.current) {
      streamRef.current = cameraStreamRef.current;
      setSharedMediaStream(cameraStreamRef.current);
      setStream(cameraStreamRef.current);
      return;
    }
    await requestAccess();
  }, [requestAccess, sharing]);

  return {
    stream,
    cameraOn,
    micOn,
    sharing,
    error,
    isRequesting,
    setCameraOn,
    setMicOn,
    requestAccess,
    startScreenShare,
    stopScreenShare,
    stopStream,
    hasStream: Boolean(stream?.active),
  };
}
