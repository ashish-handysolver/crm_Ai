import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
}

interface TranscriptPlayerProps {
  audioUrl: string;
  transcriptData: TranscriptSegment[] | null;
  fallbackText: string;
}

export default function TranscriptPlayer({ audioUrl, transcriptData, fallbackText }: TranscriptPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to active segment
  useEffect(() => {
    if (!transcriptData) return;
    const activeIndex = transcriptData.findIndex(
      s => currentTime >= s.startTime && currentTime <= s.endTime
    );
    if (activeIndex !== -1 && transcriptRef.current) {
      const activeElement = transcriptRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        // Subtle scroll into view if needed
        // activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTime, transcriptData]);

  if (!transcriptData || transcriptData.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {audioUrl && (
          <div className="bg-black/40 rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-xl">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative group cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  seekTo((x / rect.width) * duration);
                }}>
                <div
                  className="absolute inset-0 bg-indigo-500 transition-all ease-linear"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}
        <p className="text-[14px] text-slate-300 font-medium leading-[1.8] italic select-text">
          "{fallbackText}"
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Audio Control Bar */}
      <div className="bg-black/40 rounded-3xl p-4 sm:p-5 flex items-center gap-5 border border-white/10 shadow-2xl relative overflow-hidden group backdrop-blur-md">
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none"></div>

        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />

        <div className="relative shrink-0">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-500/40"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Volume2 size={12} /> Live Sync Active
            </span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div
            className="h-2 bg-slate-800 rounded-full overflow-hidden relative group cursor-pointer shadow-inner"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              seekTo((x / rect.width) * duration);
            }}
          >
            <div
              className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            {/* Hover seek point */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: 'var(--mouse-x, 0%)' }} />
          </div>
        </div>
      </div>

      {/* Interactive Transcript */}
      <div
        ref={transcriptRef}
        className="flex flex-wrap gap-x-1.5 gap-y-1 text-base leading-relaxed select-text text-slate-300"
      >
        {transcriptData.map((segment, idx) => {
          const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
          return (
            <motion.span
              key={idx}
              onClick={() => seekTo(segment.startTime)}
              animate={isActive ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
              className={`cursor-pointer px-1.5 py-0.5 rounded-lg transition-all duration-200 font-medium ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : currentTime > segment.endTime
                    ? 'text-slate-500 font-normal grayscale'
                    : 'text-slate-300 hover:bg-indigo-500/20 hover:text-white border border-transparent hover:border-indigo-500/30'
                }`}
            >
              {segment.text}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
