/**
 * Utility for client-side audio compression and downsampling.
 * Focuses on speech-optimized parameters (16kHz or 8kHz, Mono) to reduce 
 * file size and improve transcription accuracy while staying within free-tier limits.
 */

export const GROQ_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const GROQ_TARGET_AUDIO_BYTES = 24 * 1024 * 1024;

type CompressionMode = 'standard' | 'low';
type PreparedGroqChunk = {
  blob: Blob;
  durationSeconds: number;
};

/**
 * Compresses an audio Blob by downsampling.
 * 'standard' mode: 16kHz, 16-bit Mono (~31KB/s)
 * 'low' mode: 8kHz, 8-bit Mono (~8KB/s) - Ideal for very long files to fit Groq 25MB limit.
 */
export async function compressAudio(audioBlob: Blob, mode: CompressionMode = 'standard'): Promise<Blob> {
  // Safety check: 400MB is likely to crash most browser tabs during decoding
  if (audioBlob.size > 400 * 1024 * 1024) {
    console.warn("File too large for browser-based compression. Proceeding with raw file.");
    return audioBlob;
  }
  
  try {
    const audioBuffer = await decodeAudioBlob(audioBlob);
    if (!audioBuffer) {
      return audioBlob;
    }

    return compressDecodedAudio(audioBuffer, mode);
  } catch (err) {
    console.error("Audio compression failed. Proceeding with raw file.", err);
    return audioBlob;
  }
}

export async function prepareAudioForGroq(audioBlob: Blob, maxBytes: number = GROQ_MAX_AUDIO_BYTES): Promise<PreparedGroqChunk[]> {
  let standardBlob = await compressAudio(audioBlob, 'standard');
  if (standardBlob.size <= maxBytes) {
    return [{ blob: standardBlob, durationSeconds: await getAudioDurationSeconds(standardBlob) }];
  }

  const audioBuffer = await decodeAudioBlob(audioBlob);
  if (!audioBuffer) {
    if (audioBlob.size <= maxBytes) {
      return [{ blob: audioBlob, durationSeconds: await getAudioDurationSeconds(audioBlob) }];
    }
    throw new Error('Audio could not be decoded for Groq compression.');
  }

  const lowBlob = await compressDecodedAudio(audioBuffer, 'low');
  if (lowBlob.size <= maxBytes) {
    return [{ blob: lowBlob, durationSeconds: audioBuffer.duration }];
  }

  const chunkSampleCount = getMaxChunkSamples(8000, 8, 1, Math.min(maxBytes, GROQ_TARGET_AUDIO_BYTES));
  if (chunkSampleCount <= 0) {
    throw new Error('Unable to calculate a valid Groq audio chunk size.');
  }

  const normalizedBuffer = await renderSpeechOptimizedBuffer(audioBuffer, 'low');
  const chunks: PreparedGroqChunk[] = [];

  for (let start = 0; start < normalizedBuffer.length; start += chunkSampleCount) {
    const length = Math.min(chunkSampleCount, normalizedBuffer.length - start);
    const chunkBuffer = sliceAudioBuffer(normalizedBuffer, start, length);
    const chunkBlob = audioBufferToWav(chunkBuffer, 8);

    if (chunkBlob.size > maxBytes) {
      throw new Error('Compressed audio chunk still exceeds Groq 25MB limit.');
    }

    chunks.push({
      blob: chunkBlob,
      durationSeconds: length / normalizedBuffer.sampleRate,
    });
  }

  return chunks;
}

async function decodeAudioBlob(audioBlob: Blob): Promise<AudioBuffer | null> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (decodeErr) {
    console.error("Audio decoding failed. The file might be corrupted or too large for browser memory.", decodeErr);
    return null;
  } finally {
    await audioContext.close();
  }
}

async function compressDecodedAudio(audioBuffer: AudioBuffer, mode: CompressionMode): Promise<Blob> {
  const renderedBuffer = await renderSpeechOptimizedBuffer(audioBuffer, mode);
  const bitDepth = mode === 'standard' ? 16 : 8;
  return audioBufferToWav(renderedBuffer, bitDepth);
}

async function renderSpeechOptimizedBuffer(audioBuffer: AudioBuffer, mode: CompressionMode): Promise<AudioBuffer> {
  const targetSampleRate = mode === 'standard' ? 16000 : 8000;
  const offlineContext = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();

  return offlineContext.startRendering();
}

function getMaxChunkSamples(sampleRate: number, bitDepth: number, channels: number, maxBytes: number): number {
  const bytesPerSample = (bitDepth / 8) * channels;
  return Math.floor((maxBytes - 44) / bytesPerSample);
}

function sliceAudioBuffer(buffer: AudioBuffer, start: number, length: number): AudioBuffer {
  const slicedBuffer = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel).subarray(start, start + length);
    slicedBuffer.copyToChannel(channelData, channel, 0);
  }

  return slicedBuffer;
}

async function getAudioDurationSeconds(audioBlob: Blob): Promise<number> {
  const decoded = await decodeAudioBlob(audioBlob);
  return decoded?.duration || 0;
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
