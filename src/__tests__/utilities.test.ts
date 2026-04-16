import { beforeEach, describe, expect, it, vi } from 'vitest';

const addDocMock = vi.fn();
const collectionMock = vi.fn();
const timestampNowMock = vi.fn(() => 'mock-timestamp');

vi.mock('../firebase', () => ({
  db: { name: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: (...args: unknown[]) => collectionMock(...args),
  Timestamp: {
    now: () => timestampNowMock(),
  },
}));

import { logActivity } from '../utils/activity';
import { extractJsonFromText } from '../utils/gemini';
import { playNotificationSound } from '../utils/sounds';
import { openWhatsApp, WHATSAPP_TEMPLATES } from '../utils/whatsapp';

describe('shared utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs activity into the activity_logs collection', async () => {
    collectionMock.mockReturnValue('activity-collection');

    await logActivity({
      leadId: 'lead-1',
      companyId: 'company-1',
      type: 'SYSTEM',
      action: 'Lead created',
      authorUid: 'user-1',
      authorName: 'Test User',
    });

    expect(collectionMock).toHaveBeenCalledWith({ name: 'mock-db' }, 'activity_logs');
    expect(addDocMock).toHaveBeenCalledWith('activity-collection', expect.objectContaining({
      leadId: 'lead-1',
      companyId: 'company-1',
      action: 'Lead created',
      createdAt: 'mock-timestamp',
    }));
  });

  it('extracts JSON from fenced and embedded strings', () => {
    expect(extractJsonFromText('```json\n{"status":"ok"}\n```')).toEqual({ status: 'ok' });
    expect(extractJsonFromText('Result: {"count":2} done')).toEqual({ count: 2 });
    expect(extractJsonFromText('prefix [1,2,3] suffix')).toEqual([1, 2, 3]);
    expect(extractJsonFromText('not json')).toBeNull();
  });

  it('opens WhatsApp with a sanitized number and encoded text', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    openWhatsApp('+91 98765-43210', 'Hello team & client');

    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/919876543210?text=Hello%20team%20%26%20client',
      '_blank'
    );
  });

  it('builds WhatsApp recap content from AI insights', () => {
    const recap = WHATSAPP_TEMPLATES.find((template) => template.id === 'meeting-recap');

    expect(recap).toBeTruthy();
    expect(
      recap!.generate({
        leadName: 'Ava',
        meetingUrl: 'https://example.com/meeting',
        aiInsights: {
          overview: 'Strong product interest',
          meetingMinutes: ['Budget approved'],
          tasks: [{ title: 'Send proposal' }],
        },
      })
    ).toContain('Ava');
  });

  it('plays notification sound and closes the audio context later', () => {
    vi.useFakeTimers();

    const frequencySetValueAtTime = vi.fn();
    const gainSetValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const oscillatorStart = vi.fn();
    const oscillatorStop = vi.fn();
    const close = vi.fn();

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createOscillator() {
        return {
          connect: vi.fn(),
          type: 'sine',
          frequency: { setValueAtTime: frequencySetValueAtTime },
          start: oscillatorStart,
          stop: oscillatorStop,
        };
      }

      createGain() {
        return {
          connect: vi.fn(),
          gain: {
            setValueAtTime: gainSetValueAtTime,
            linearRampToValueAtTime,
            exponentialRampToValueAtTime,
          },
        };
      }

      close = close;
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });

    playNotificationSound('neural_ping');
    vi.advanceTimersByTime(12000);

    expect(frequencySetValueAtTime).toHaveBeenCalled();
    expect(oscillatorStart).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
