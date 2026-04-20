/**
 * Utility for client-side audio compression and downsampling.
 * Focuses on speech-optimized parameters (16kHz or 8kHz, Mono) to reduce 
 * file size and improve transcription accuracy while staying within free-tier limits.
 */

/**
 * Compresses an audio Blob by downsampling.
 * 'standard' mode: 16kHz, 16-bit Mono (~31KB/s)
 * 'low' mode: 8kHz, 8-bit Mono (~8KB/s) - Ideal for very long files to fit Groq 25MB limit.
 */
export async function compressAudio(audioBlob: Blob, mode: 'standard' | 'low' = 'standard'): Promise<Blob> {
  // Safety check: 400MB is likely to crash most browser tabs during decoding
  if (audioBlob.size > 400 * 1024 * 1024) {
    console.warn("File too large for browser-based compression. Proceeding with raw file.");
    return audioBlob;
  }

  const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
  const audioContext = new AudioContextClass();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    let audioBuffer;
    
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.error("Audio decoding failed. The file might be corrupted or too large for browser memory.", decodeErr);
      return audioBlob;
    }
    
    const targetSampleRate = mode === 'standard' ? 16000 : 8000;
    const bitDepth = mode === 'standard' ? 16 : 8;

    const offlineContext = new OfflineAudioContext(
      1, // Mono
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    
    return audioBufferToWav(renderedBuffer, bitDepth);
  } finally {
    await audioContext.close();
  }
}

/**
 * Encodes an AudioBuffer into a WAV Blob with support for 8-bit and 16-bit PCM.
 */
function audioBufferToWav(buffer: AudioBuffer, bitDepth: number): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  
  const byteRate = (sampleRate * numberOfChannels * bitDepth) / 8;
  const blockAlign = (numberOfChannels * bitDepth) / 8;
  const dataSize = buffer.length * numberOfChannels * (bitDepth / 8);
  const bufferLength = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  const offset = 44;
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    
    if (bitDepth === 8) {
      // 8-bit PCM is unsigned: [0, 255]
      const value = Math.round((sample + 1) * 127.5);
      view.setUint8(offset + i, value);
    } else {
      // 16-bit PCM is signed: [-32768, 32767]
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (i * 2), value, true);
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
