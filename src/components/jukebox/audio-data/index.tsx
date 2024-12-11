import { FC, useEffect, useRef, useState, useCallback } from 'react';
import { AudioData, NetworkStats, BufferStrategy, AudioCallbacks } from './types';
import { calculateBufferStrategy, calculateNetworkStats, calculateBufferHealth } from './utils';
import { fetchMusicData } from '../../../utils/fetchMusicData';
import { PlaybackStats } from '../playlist/types';

interface AudioDataManagerProps {
  onDataUpdate: (data: AudioData) => void;
  onBufferStrategyUpdate: (strategy: BufferStrategy) => void;
}

export const AudioDataMonitor: FC<AudioDataManagerProps> = ({ 
  onDataUpdate,
  onBufferStrategyUpdate
}) => {
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const lastUpdateRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: Date.now() });

  useEffect(() => {
    if (audioData) {
      // This log has been removed
    }
  }, [audioData]);

  const updateAudioData = useCallback((audio: HTMLAudioElement) => {
    if (!audio || !audio.src) {
      console.log('🚫 AudioDataMonitor: No audio source available');
      return;
    }
    
    console.log('🎧 AudioDataMonitor: Updating from audio event:', {
      src: audio.src,
      readyState: audio.readyState,
      networkState: audio.networkState,
      currentTime: audio.currentTime,
      duration: audio.duration
    });
    
    const bufferedRegions = Array.from(
      { length: audio.buffered.length },
      (_, i) => ({
        start: audio.buffered.start(i),
        end: audio.buffered.end(i)
      })
    );

    // Get connection info if available
    const connection = (navigator as any).connection;
    const networkInfo = connection ? {
      downlink: connection.downlink,
      effectiveType: connection.effectiveType,
      rtt: connection.rtt
    } : {
      downlink: 10,
      effectiveType: '4g',
      rtt: 50
    };

    // Calculate buffer fill rate
    const currentBytes = bufferedRegions[0]?.end || 0;
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateRef.current.time;
    const bytesDiff = currentBytes - lastUpdateRef.current.bytes;
    const fillRate = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0;

    lastUpdateRef.current = { bytes: currentBytes, time: currentTime };

    // Calculate audio format and file size
    const channels = 2; // Stereo
    const sampleRate = 48000; // High quality
    const bitDepth = 16; // CD quality
    const bytesPerSecond = (sampleRate * channels * bitDepth) / 8;
    const bitRate = (bytesPerSecond * 8) / 1000; // kbps

    const newAudioData: AudioData = {
      playback: {
        readyState: audio.readyState,
        networkState: audio.networkState,
        buffered: bufferedRegions,
        currentTime: audio.currentTime,
        duration: audio.duration || 0
      },
      networkStats: {
        downlink: networkInfo.downlink,
        effectiveType: networkInfo.effectiveType,
        rtt: networkInfo.rtt,
        bufferFillRate: fillRate,
        lastRebuffer: currentTime
      },
      format: {
        channels: 2, // Default to stereo
        sampleRate: 44100, // Default to standard sample rate
        bitDepth: 16,
        duration: audio.duration || 0
      },
      file: {
        size: 0,
        path: audio.src,
        contentType: 'audio/wav',
        bitRate: 128 // Default to standard bitrate for WAV
      }
    };

    console.log('📤 AudioDataMonitor: Sending audio data update:', {
      hasPlayback: !!newAudioData.playback,
      currentTime: newAudioData.playback?.currentTime,
      readyState: newAudioData.playback?.readyState,
      networkState: newAudioData.playback?.networkState,
      bufferedRegions: newAudioData.playback?.buffered?.length || 0
    });

    setAudioData(newAudioData);
    onDataUpdate(newAudioData);

    // Update buffer strategy based on network conditions
    const strategy = calculateBufferStrategy(newAudioData.networkStats);
    onBufferStrategyUpdate(strategy);
  }, [onDataUpdate, onBufferStrategyUpdate]);

  // Monitor audio element
  useEffect(() => {
    const audio = document.querySelector('.jukebox-audio') as HTMLAudioElement;
    if (!audio) {
      console.log('🚫 AudioDataMonitor: No audio element found');
      return;
    }

    const events = [
      'loadstart',
      'loadedmetadata', 
      'progress',
      'timeupdate',
      'canplay',
      'playing',
      'pause',
      'seeking',
      'seeked',
      'ended'
    ];

    console.log('🎧 AudioDataMonitor: Setting up listeners for events:', events);

    const handleAudioEvent = (event: Event) => {
      console.log('🎵 AudioDataMonitor: Received audio event:', {
        type: event.type,
        src: audio.src,
        readyState: audio.readyState,
        currentTime: audio.currentTime
      });
      if (audio.src) {
        updateAudioData(audio);
      }
    };

    // Add event listeners
    events.forEach((event: string) => {
      audio.addEventListener(event, handleAudioEvent);
    });

    return () => {
      // Remove event listeners
      events.forEach((event: string) => {
        audio.removeEventListener(event, handleAudioEvent);
      });
    };
  }, [updateAudioData]);

  return null;
};

export class AudioDataManager {
  private audio: HTMLAudioElement | null = null;
  private isInitialized = false;
  private isTransitioning = false;
  private eventListeners: Array<{
    event: string;
    handler: EventListener;
  }> = [];
  private callbacks: AudioCallbacks;
  private lastBufferUpdate = 0;
  private lastBufferedBytes = 0;
  private onSongEndCallback?: () => void;

  constructor(callbacks: AudioCallbacks) {
    console.log('🎵 Initializing audio manager');
    this.callbacks = callbacks;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.autoplay = false;
    
    this.isInitialized = false;
    this.isTransitioning = false;
    this.onSongEndCallback = callbacks.onSongEnd;
    this.setupAudioListeners();
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public get onSongEnd(): (() => void) | undefined {
    return this.onSongEndCallback;
  }

  public set onSongEnd(callback: (() => void) | undefined) {
    this.onSongEndCallback = callback;
  }

  private cleanupAudioListeners(): void {
    const audio = this.audio;
    if (!audio) return;
    
    // Remove all existing event listeners
    this.eventListeners.forEach(({ event, handler }) => {
      audio.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  private addEventListenerWithCleanup(event: string, handler: EventListener): void {
    const audio = this.audio;
    if (!audio) return;
    
    audio.addEventListener(event, handler);
    this.eventListeners.push({ event, handler });
  }

  private setupAudioListeners(): void {
    const audio = this.audio;
    if (!audio) {
      console.error('❌ Cannot setup listeners - audio element is null');
      return;
    }

    // Remove existing listeners first
    this.cleanupAudioListeners();

    // Set up ended event handler
    this.addEventListenerWithCleanup('ended', () => {
      console.log('🎵 Song ended');
      this.handleSongEnd();
    });

    // Set up time update handler
    this.addEventListenerWithCleanup('timeupdate', () => {
      this.refreshPlaybackState();
    });

    // Set up buffering handlers
    this.addEventListenerWithCleanup('waiting', () => {
      const state = {
        readyState: audio.readyState,
        networkState: audio.networkState,
        buffered: Array.from({ length: audio.buffered.length }, (_, i) => ({
          start: audio.buffered.start(i),
          end: audio.buffered.end(i)
        }))
      };
      console.log('⏳ Buffering:', state);
      this.callbacks.onBufferingChange(true);
    });

    this.addEventListenerWithCleanup('canplay', () => {
      console.log('✅ Ready to play:', {
        duration: audio.duration,
        readyState: audio.readyState
      });
      this.callbacks.onBufferingChange(false);
    });

    // Add error listener
    this.addEventListenerWithCleanup('error', (e: Event) => {
      console.error('❌ Audio error:', {
        error: audio.error?.message || 'Unknown error',
        code: audio.error?.code,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    });
  }

  public async loadAudio(path: string): Promise<void> {
    try {
      // Store callback before reinitialization
      const savedCallback = this.onSongEndCallback;

      // Create new audio element if needed
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.autoplay = false;
      }

      const audio = this.audio;
      
      // Clean up existing state
      this.cleanup();
      
      // Restore callback after cleanup
      this.onSongEndCallback = savedCallback;

      // Set up new audio element
      const url = `https://ogmash.ecousins25.workers.dev/audio/${encodeURIComponent(path)}`;
      
      console.log('🎵 Loading audio:', {
        path,
        url
      });

      // Wait for audio to be loaded
      await new Promise<void>((resolve, reject) => {
        const loadHandler = () => {
          audio.removeEventListener('loadeddata', loadHandler);
          audio.removeEventListener('error', errorHandler);
          resolve();
        };
        
        const errorHandler = (e: Event) => {
          audio.removeEventListener('loadeddata', loadHandler);
          audio.removeEventListener('error', errorHandler);
          reject(new Error(`Failed to load audio: ${(e as ErrorEvent).message}`));
        };

        audio.addEventListener('loadeddata', loadHandler);
        audio.addEventListener('error', errorHandler);
        
        audio.src = url;
        audio.load();
      });

      // Set up event listeners after successful load
      this.setupAudioListeners();
      this.isInitialized = true;

      console.log('✅ Audio loaded successfully:', {
        duration: audio.duration,
        readyState: audio.readyState,
        hasEndCallback: !!this.onSongEndCallback
      });
    } catch (error) {
      console.error('❌ Failed to load audio:', error);
      this.cleanup();
      throw error;
    }
  }

  public handleSongEnd(): void {
    console.log('🎵 handleSongEnd called', {
      hasCallback: !!this.onSongEndCallback,
      isTransitioning: this.isTransitioning,
      isInitialized: this.isInitialized
    });
    
    if (this.onSongEndCallback && !this.isTransitioning && this.isInitialized) {
      try {
        this.onSongEndCallback();
      } catch (error) {
        console.error('❌ Error in song end callback:', error);
      }
    }
  }

  public cleanup(): void {
    const audio = this.audio;
    if (!audio) return;

    // Store callback before cleanup
    const savedCallback = this.onSongEndCallback;

    // Only log if we have active listeners to clean up AND we're not in initial mount/unmount cycle
    const hasActiveListeners = this.eventListeners.length > 0;
    const isInitialCleanup = !this.isInitialized;
    
    if (hasActiveListeners && !isInitialCleanup) {
      console.log('🧹 Cleaning up audio manager event listeners');
      this.cleanupAudioListeners();
    } else {
      this.cleanupAudioListeners(); // Still cleanup, just don't log it
    }

    // Reset audio state
    audio.pause();
    audio.currentTime = 0;
    
    // Store current src for logging
    const previousSrc = audio.src;
   
    if (previousSrc && !isInitialCleanup) {
      console.log('🔄 Audio state reset', {
        previousSrc,
        currentTime: audio.currentTime,
        isResetting: true
      });
    }

    // Reset state but preserve callback
    this.isInitialized = false;
    this.isTransitioning = false;
    this.lastBufferUpdate = 0;
    this.lastBufferedBytes = 0;
    this.onSongEndCallback = savedCallback; // Restore callback

    // Ensure audio element is completely reset
    audio.removeAttribute('src');
    audio.load();
  }

  public async seek(time: number): Promise<void> {
    if (!this.isInitialized || !this.audio) {
      console.warn('⚠️ Cannot seek - audio not initialized');
      return;
    }

    const audio = this.audio;
    const wasPlaying = !audio.paused;
    
    try {
      // Ensure we have valid audio data before seeking
      if (!isFinite(time) || !isFinite(audio.duration)) {
        console.warn('⚠️ Invalid seek time or duration:', { time, duration: audio.duration });
        return;
      }

      // Clamp seek time to valid range
      const clampedTime = Math.max(0, Math.min(time, audio.duration));
      
      // Check if we have buffered data at the seek point
      let hasBufferedData = false;
      for (let i = 0; i < audio.buffered.length; i++) {
        if (clampedTime >= audio.buffered.start(i) && clampedTime <= audio.buffered.end(i)) {
          hasBufferedData = true;
          break;
        }
      }

      if (!hasBufferedData) {
        console.log('🔄 Seeking to unbuffered position, reloading audio');
        // Temporarily remove timeupdate listener to prevent unnecessary updates
        const timeupdateListener = this.eventListeners.find(l => l.event === 'timeupdate');
        if (timeupdateListener) {
          audio.removeEventListener('timeupdate', timeupdateListener.handler);
        }

        // Reload audio and set initial time
        await new Promise<void>((resolve) => {
          const canplayHandler = () => {
            audio.currentTime = clampedTime;
            audio.removeEventListener('canplay', canplayHandler);
            resolve();
          };
          audio.addEventListener('canplay', canplayHandler);
          audio.load();
        });

        // Reattach timeupdate listener
        if (timeupdateListener) {
          audio.addEventListener('timeupdate', timeupdateListener.handler);
        }
      } else {
        // Direct seek if we have buffered data
        audio.currentTime = clampedTime;
      }

      console.log('⏩ Seek completed:', {
        requestedTime: time,
        actualTime: audio.currentTime,
        hasBufferedData,
        wasPlaying
      });

      // Resume playback if it was playing before
      if (wasPlaying) {
        await this.play();
      }

      // Refresh playback state after seek
      this.refreshPlaybackState();
    } catch (error) {
      console.error('❌ Seek failed:', error);
      throw error;
    }
  }

  public async play(): Promise<void> {
    const audio = this.audio;
    if (!audio) return;

    try {
      console.log('▶️ Playing:', {
        path: audio.src,
        currentTime: audio.currentTime,
        duration: audio.duration
      });
      await audio.play();
      console.log('✅ Playback started');
    } catch (error) {
      console.error('❌ Play error:', error);
      throw error;
    }
  }

  public pause(): void {
    if (!this.audio) return;
    
    try {
      console.log('⏸️ Pausing playback at:', this.audio.currentTime);
      this.audio.pause();
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  }

  public async resume(): Promise<void> {
    if (!this.audio) return;

    try {
      const resumeTime = this.audio.currentTime;
      console.log('▶️ Resuming playback from:', resumeTime);
      
      // Simply play the audio without reloading or resetting state
      await this.audio.play();
    } catch (error) {
      console.error('Failed to resume playback:', error);
      throw error;
    }
  }

  private refreshPlaybackState(): void {
    if (!this.audio || !this.isInitialized) return;

    const audio = this.audio;
    const currentTime = audio.currentTime || 0;
    const duration = audio.duration || 0;
    const buffered = audio.buffered;
    
    // Calculate buffer progress
    let bufferProgress = 0;
    if (buffered.length > 0) {
      const currentBufferEnd = buffered.end(buffered.length - 1);
      bufferProgress = (currentBufferEnd / duration) * 100;
    }

    // Get connection info
    const connection = (navigator as any).connection;
    const networkInfo = connection ? {
      downlink: connection.downlink,
      effectiveType: connection.effectiveType,
      rtt: connection.rtt
    } : {
      downlink: 10,
      effectiveType: '4g',
      rtt: 50
    };

    // Update audio data
    const audioData: AudioData = {
      networkStats: {
        ...networkInfo,
        bufferFillRate: bufferProgress,
        lastRebuffer: 0
      },
      playback: {
        readyState: audio.readyState,
        networkState: audio.networkState,
        buffered: Array.from(
          { length: buffered.length },
          (_, i) => ({
            start: buffered.start(i),
            end: buffered.end(i)
          })
        ),
        currentTime,
        duration
      },
      format: {
        channels: 2, // Default to stereo
        sampleRate: 44100, // Default to standard sample rate
        bitDepth: 16,
        duration
      },
      file: {
        size: Math.floor((44100 * 16 * 2 * duration) / 8),
        path: audio.src,
        contentType: 'audio/wav',
        bitRate: 44100 * 16 * 2
      }
    };

    this.callbacks.onAudioDataUpdate?.(audioData);

    // Only update buffer progress if it's changed significantly
    const now = Date.now();
    if (now - this.lastBufferUpdate > 1000 || Math.abs(bufferProgress - this.lastBufferedBytes) > 5) {
      this.lastBufferUpdate = now;
      this.lastBufferedBytes = bufferProgress;
      this.callbacks.onBufferProgress(bufferProgress);
    }

    // Update playback stats
    if (isFinite(currentTime) && isFinite(duration)) {
      this.callbacks.onPlaybackStats({
        currentTime,
        duration,
        isTransitioning: this.isTransitioning,
        nextSongPreloaded: false
      });
    }
  }

  private getAudioUrl(path: string): string {
    const url = `https://ogmash.ecousins25.workers.dev/audio/${encodeURIComponent(path)}`;
    return url;
  }

  private async initializeAudio(): Promise<void> {
    const audio = this.audio;
    if (!audio) {
      throw new Error('Audio element not initialized');
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const audio = this.audio;
        if (!audio) {
          reject(new Error('Audio element not initialized'));
          return;
        }

        const initHandler = () => {
          console.log('✅ Audio canplay event received');
          this.isInitialized = true;
          audio.removeEventListener('canplay', initHandler);
          audio.removeEventListener('error', errorHandler);
          resolve();
        };
                
        const errorHandler = (e: ErrorEvent) => {
          const error = (e as ErrorEvent).error || new Error('Audio initialization failed');
          console.error('❌ Audio initialization error:', error);
          audio.removeEventListener('canplay', initHandler);
          audio.removeEventListener('error', errorHandler);
          reject(error);
        };

        console.log('🎵 Setting up initialization listeners');
        audio.addEventListener('canplay', initHandler);
        audio.addEventListener('error', errorHandler);
        
        // Load the audio to trigger initialization
        audio.load();
      });

      console.log('✅ Audio initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
      throw error;
    }
  }

  public resetPlaybackPosition(): void {
    if (this.audio) {
      this.audio.currentTime = 0;
    }
  }
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
