/** Keeps a MediaStream alive across route changes (join → meeting). */
let sharedStream: MediaStream | null = null;

export function setSharedMediaStream(stream: MediaStream | null) {
  sharedStream = stream;
}

export function consumeSharedMediaStream(): MediaStream | null {
  const current = sharedStream;
  sharedStream = null;
  return current;
}

export function peekSharedMediaStream(): MediaStream | null {
  return sharedStream;
}
