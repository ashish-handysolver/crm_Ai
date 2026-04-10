/**
 * Neural Audio Protocol v1.0
 * Generates premium diagnostic tones using the Web Audio API.
 */

export type SoundProfile = 'cyber_pulse' | 'crystal_echo' | 'neural_ping' | 'digital_blip' | 'high_intensity';

export const NOTIFICATION_SOUNDS: { id: SoundProfile; name: string }[] = [
  { id: 'cyber_pulse', name: 'Cyber Pulse (Original)' },
  { id: 'crystal_echo', name: 'Crystal Echo' },
  { id: 'neural_ping', name: 'Neural Ping' },
  { id: 'digital_blip', name: 'Digital Blip' },
  { id: 'high_intensity', name: 'High Intensity Alert (10s)' }
];

export const playNotificationSound = (profile: SoundProfile = 'cyber_pulse') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (freq: number, startAt: number, duration: number, volume: number = 0.15, type: OscillatorType = 'sine', decay: boolean = false) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.02);
      
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      } else {
        gain.gain.setValueAtTime(volume, ctx.currentTime + startAt + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + duration);
      }
      
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    switch (profile) {
      case 'crystal_echo':
        // High pitched elegant chime
        playTone(1760, 0, 1.5, 0.1, 'sine', true);
        playTone(880, 0.1, 1.2, 0.08, 'sine', true);
        break;

      case 'neural_ping':
        // Sharp digital ping
        playTone(1200, 0, 0.15, 0.12, 'sine');
        playTone(2400, 0.02, 0.08, 0.05, 'sine');
        break;

      case 'digital_blip':
        // Square wave tech blip
        playTone(600, 0, 0.1, 0.08, 'square');
        playTone(800, 0.1, 0.1, 0.06, 'square');
        break;

      case 'high_intensity':
        // High volume rhythmic alert for 10 seconds
        for (let i = 0; i < 10; i++) {
          const base = i * 1.0;
          playTone(880, base, 0.25, 0.6, 'square', true);
          playTone(440, base + 0.5, 0.25, 0.5, 'square', true);
        }
        break;

      case 'cyber_pulse':
      default:
        // Original pulse sound
        for (let i = 0; i < 3; i++) {
          const base = i * 0.8;
          playTone(480, base, 0.3, 0.15);
          playTone(440, base, 0.3, 0.15);
        }
        break;
    }

    // Close context after enough time for longest sound (10s + buffer)
    setTimeout(() => ctx.close(), 12000);
  } catch (e) {
    console.error('Core audio transmission failed:', e);
  }
};
