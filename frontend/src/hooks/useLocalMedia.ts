import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalMedia(initialCameraOn = true, initialMicOn = true) {
  const [cameraOn, setCameraOn] = useState(initialCameraOn);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const requestAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera and microphone are not supported in this browser.");
      return null;
    }

    setIsRequesting(true);
    setError(null);

    try {
      stopStream();
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      media.getVideoTracks().forEach((track) => {
        track.enabled = cameraOn;
      });
      media.getAudioTracks().forEach((track) => {
        track.enabled = micOn;
      });
      streamRef.current = media;
      cameraStreamRef.current = media;
      setStream(media);
      return media;
    } catch {
      setError(
        "Could not access camera or microphone. Click Allow in the browser prompt, or check site permissions in your browser settings.",
      );
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [cameraOn, micOn, stopStream]);

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
      setStream(cameraStreamRef.current);
      return;
    }
    await requestAccess();
  }, [requestAccess, sharing]);

  useEffect(() => () => stopStream(), [stopStream]);

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
    hasStream: Boolean(stream),
  };
}
