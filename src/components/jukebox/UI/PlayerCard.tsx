import { FC, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AudioData } from '../audio-data/types';
import { PlaybackStats, PlaylistItem, PlaylistState, PlaybackMode } from '../playlist/types';
import { AudioDataManager } from '../audio-data';
import { ArrowPathIcon, ChevronDownIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

interface PlayerCardProps {
  audioData: AudioData | null;
  audioDataManager: AudioDataManager | null;
  playlistState: PlaylistState;
  playbackStats: PlaybackStats;
  currentSong: PlaylistItem | null;
  onPlay: () => void;
  onPause: () => void;
  isBuffering: boolean;
  bufferProgress: number;
  onPlayPlaylist: () => void;
  onPlayModeChange: (state: Partial<PlaylistState>) => void;
}

interface UIState {
  mode: PlaybackMode;
  isPlaying: boolean;
  currentSong?: string;
  buttonText: string;
  audioState?: {
    hasAudioData: boolean;
    hasPlayback: boolean;
    currentTime: number;
    readyState?: number;
  };
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface ButtonContent {
  onClick: () => void;
  icon: JSX.Element;
  text: string;
  baseColor: string;
}

export const PlayerCard: FC<PlayerCardProps> = ({
  audioData,
  audioDataManager,
  playlistState,
  playbackStats,
  currentSong,
  onPlay,
  onPause,
  isBuffering,
  bufferProgress,
  onPlayPlaylist,
  onPlayModeChange,
}) => {
  const [debouncedBuffering, setDebouncedBuffering] = useState(isBuffering);
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [playModeButtonText, setPlayModeButtonText] = useState('');
  const prevStateRef = useRef<{
    mode: PlaybackMode;
    isPlaying: boolean;
    currentSong: string | null;
    audioState?: {
      hasData: boolean;
      hasPlayback: boolean;
      currentTime: number;
    };
  }>();
  const lastLogTimeRef = useRef(0);
  const LOG_INTERVAL = 2000; // 2 seconds
  const PREVIEW_DURATION = 10000; // 10 seconds for preview mode
  let previewTimeout: NodeJS.Timeout | null = null;

  const audioRef = useMemo(() => {
    if (typeof window !== 'undefined') {
      return document.createElement('audio');
    }
    return null;
  }, []);

  // Add throttled logging function
  const logIfNeeded = useCallback((message: string, data: any) => {
    const now = Date.now();
    if (now - lastLogTimeRef.current >= LOG_INTERVAL) {
      console.log(message, data);
      lastLogTimeRef.current = now;
    }
  }, []);

  // Update UI state logging
  const updateUIState = useCallback((state: UIState) => {
    logIfNeeded('🎮 UI state updated:', state);
  }, [logIfNeeded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }

    if (isBuffering) {
      setDebouncedBuffering(true);
    } else {
      bufferingTimeoutRef.current = setTimeout(() => {
        setDebouncedBuffering(false);
      }, 300);
    }

    return () => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }
    };
  }, [isBuffering]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (playlistState.mode === 'preview' && 
        playlistState.isPlaying && 
        playbackStats.currentTime >= 10) {
      const audio = document.querySelector('.jukebox-audio') as HTMLAudioElement;
      if (audio) {
        audio.dispatchEvent(new Event('ended'));
      }
    }
  }, [playlistState.mode, playlistState.isPlaying, playbackStats.currentTime]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (currentSong && playbackStats?.currentTime > 0) {
      const formattedCurrentTime = formatTime(playbackStats.currentTime);
      const formattedDuration = formatTime(playbackStats.duration);
    }
  }, [currentSong, playbackStats?.currentTime, playbackStats?.duration]);

  useEffect(() => {
    const currentState = {
      mode: playlistState.mode,
      isPlaying: playlistState.isPlaying,
      currentSong: currentSong?.songName || null,
      audioState: audioData ? {
        hasData: !!audioData,
        hasPlayback: !!audioData?.playback,
        currentTime: audioData?.playback?.currentTime || 0
      } : undefined
    };

    const hasSignificantChange = !prevStateRef.current ||
      prevStateRef.current.mode !== currentState.mode ||
      prevStateRef.current.isPlaying !== currentState.isPlaying ||
      prevStateRef.current.currentSong !== currentState.currentSong ||
      (currentState.audioState && (!prevStateRef.current.audioState ||
        Math.abs(currentState.audioState.currentTime - (prevStateRef.current.audioState?.currentTime || 0)) >= 1.0));

    if (hasSignificantChange) {
      if (currentState.currentSong) {
        const now = Date.now();
        if (now - lastLogTimeRef.current >= LOG_INTERVAL) {
          console.log('🎮 Player state:', {
            mode: currentState.mode,
            isPlaying: currentState.isPlaying,
            currentSong: currentState.currentSong,
            playback: currentState.audioState
          });
          lastLogTimeRef.current = now;
        }
      }
      prevStateRef.current = currentState;
    }
  }, [playlistState, currentSong, audioData]);

  const getButtonContent = useCallback((): ButtonContent => {
    const audio = document.querySelector('.jukebox-audio') as HTMLAudioElement;
    const currentTime = audio?.currentTime || audioData?.playback?.currentTime || 0;
    
    // Playing state (song exists and is currently playing)
    if (currentSong && playlistState.isPlaying) {
        return {
            onClick: handlePlayPauseResume,
            icon: <PauseIcon className="h-6 w-6" />,
            text: 'Pause',
            baseColor: 'bg-blue-600 hover:bg-blue-700'
        };
    }

    // Initial play state (song exists but hasn't started playing)
    if (currentSong && !playlistState.isPlaying) {
        return {
            onClick: handlePlayPauseResume,
            icon: <PlayIcon className="h-6 w-6" />,
            text: 'Play',
            baseColor: 'bg-blue-600 hover:bg-blue-700'
        };
    }

    // Default play state - this is the initial state showing the mode
    const modeText = playlistState.mode === 'preview' ? 'Preview All' 
                   : playlistState.mode === 'shuffle' ? 'Play Shuffled' 
                   : 'Play In Order';
                   
    return {
        onClick: onPlayPlaylist,
        icon: <PlayIcon className="h-6 w-6" />,
        text: modeText,
        baseColor: 'bg-blue-600 hover:bg-blue-700'
    };
  }, [currentSong, playlistState.isPlaying, playlistState.mode]);

  const handlePlayPauseResume = useCallback(async (shouldResume = false) => {
    if (!audioDataManager) return;

    try {
      if (playlistState.isPlaying) {
        console.log('⏸️ Pausing playback');
        audioDataManager.pause();
        onPlayModeChange({ ...playlistState, isPlaying: false });
      } else if (shouldResume && currentSong) {
        console.log('▶️ Resuming playback');
        // Resume directly without reloading audio
        await audioDataManager.resume();
        onPlayModeChange({ ...playlistState, isPlaying: true });
      } else {
        console.log('▶️ Starting playback');
        await audioDataManager.play();
        onPlayModeChange({ ...playlistState, isPlaying: true });
      }
    } catch (error) {
      console.error('❌ Playback control error:', error);
    }
  }, [audioDataManager, playlistState, onPlayModeChange, currentSong]);

  // Memoize button content
  const buttonContent = useMemo(() => getButtonContent(), [getButtonContent]);

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioDataManager || !currentSong || !playbackStats.duration) return;

    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = percentage * playbackStats.duration;
    
    try {
      // Ensure audio is initialized before seeking
      if (!audioDataManager.initialized) {
        console.log('🔄 Reinitializing audio before seek');
        await audioDataManager.loadAudio(currentSong.path);
      }
      await audioDataManager.seek(seekTime);
    } catch (error) {
      console.error('❌ Failed to seek:', error);
    }
  };

  // Add mouse move handler for hover effect
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackStats.duration) return;
    
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setHoverPosition(percentage * 100);
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const handleModeChange = async (newMode: PlaybackMode) => {
    console.log('🎮 Mode change initiated:', { 
      from: playlistState.mode, 
      to: newMode,
      currentlyPlaying: playlistState.isPlaying,
      currentSong: currentSong?.songName || 'none',
      currentIndex: playlistState.currentIndex,
      function: 'handleModeChange'
    });

    // Clear any existing preview timeout
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }

    // Stop current playback and reset audio state
    if (audioDataManager) {
      audioDataManager.pause();
      audioDataManager.cleanup();

      // Reset playlist state completely
      const resetState = { 
        mode: newMode,
        isPlaying: false,
        currentIndex: 0,
        currentSong: undefined
      };

      console.log('🔄 Resetting playlist state:', {
        function: 'handleModeChange',
        newState: resetState,
        previousState: playlistState
      });

      onPlayModeChange(resetState);

      // Force button text update for initial play state
      const modeText = newMode === 'normal' ? 'In Order' :
                      newMode === 'shuffle' ? 'Shuffle' :
                      'Preview';
      setPlayModeButtonText(`Play ${modeText}`);

      // If we have items in the playlist, always start with the first song
      if (playlistState.items.length > 0) {
        try {
          const firstSong = playlistState.items[0];

          console.log('🔄 Reinitializing audio for mode change:', {
            function: 'handleModeChange',
            song: firstSong.songName,
            path: firstSong.path,
            newMode
          });

          await audioDataManager.loadAudio(firstSong.path);
          
          // Update state with first song and ensure we start from beginning
          const newState = {
            mode: newMode,
            isPlaying: false,
            currentIndex: 0,
            currentSong: firstSong.songName
          };

          console.log('✅ Mode change completed:', {
            function: 'handleModeChange',
            newState,
            audioLoaded: true
          });

          onPlayModeChange(newState);
          audioDataManager.resetPlaybackPosition();

          // Start playback immediately after mode change is complete
          onPlayPlaylist();
        } catch (error) {
          console.error('❌ Failed to reinitialize audio:', error);
        }
      }
    } else {
      // If no audio manager, just update the mode
      console.log('⚠️ Mode change without audio manager:', {
        function: 'handleModeChange',
        newMode,
        currentSong: currentSong?.songName
      });

      onPlayModeChange({ 
        mode: newMode,
        isPlaying: false,
        currentIndex: 0,
        currentSong: undefined
      });
    }
  };

  const handleRepeatChange = (repeat: boolean) => {
    onPlayModeChange({ 
      repeat,
      // Preserve other state values
      mode: playlistState.mode,
      currentIndex: playlistState.currentIndex,
      isPlaying: playlistState.isPlaying
    });
  };

  // Add logging for mode changes
  useEffect(() => {
    // Only log mode changes after initial mount and when we have a song
    if (currentSong) {
      const now = Date.now();
      if (now - lastLogTimeRef.current >= LOG_INTERVAL) {
        console.log('🔄 PlayerCard mode changed:', {
          mode: playlistState.mode,
          isPlaying: playlistState.isPlaying,
          currentSong: currentSong?.songName || 'none'
        });
        lastLogTimeRef.current = now;
      }
    }
  }, [playlistState.mode, playlistState.isPlaying, currentSong]);

  const getPlayModeButtonText = () => {
    // Get mode text
    const modeText = playlistState.mode === 'normal' ? 'In Order' :
                    playlistState.mode === 'shuffle' ? 'Shuffle' :
                    'Preview';

    // If we're at the start of a track or no track is loaded, or just switched modes, show initial play state
    const showInitialState = !currentSong || 
                           (audioData?.playback?.currentTime === 0) ||
                           (audioData?.playback?.currentTime === audioData?.playback?.duration) ||
                           (!playlistState.isPlaying && !audioData?.playback?.currentTime);

    // Always show "Play {mode}" after a mode change or at start
    const buttonText = showInitialState ? `Play ${modeText}` :
                      playlistState.isPlaying ? `Pause ${modeText}` : 
                      `Play ${modeText}`;

    return buttonText;
  };

  useEffect(() => {
    const newText = getPlayModeButtonText();
    setPlayModeButtonText(newText);
  }, [playlistState.mode, playlistState.isPlaying, currentSong]);

  // Combine mode change and button text logs with additional data
  useEffect(() => {
    if (currentSong) {
        const uiState = {
            mode: playlistState.mode,
            isPlaying: playlistState.isPlaying,
            currentSong: currentSong.songName,
            buttonText: getPlayModeButtonText(),
            audioState: {
                hasAudioData: !!audioData,
                hasPlayback: !!audioData?.playback,
                currentTime: audioData?.playback?.currentTime || 0,
                readyState: audioData?.playback?.readyState || 0
            }
        };
        updateUIState(uiState);
    }
  }, [playlistState.mode, playlistState.isPlaying, currentSong, audioData, updateUIState]);

  // Add preview mode timeout handling
  useEffect(() => {
    // Clear any existing timeout when component updates
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }

    // Only set timeout if in preview mode and playing
    if (playlistState.mode === 'preview' && playlistState.isPlaying) {
      console.log('⏲️ Starting preview timeout:', {
        currentSong: currentSong?.songName,
        duration: PREVIEW_DURATION,
        currentIndex: playlistState.currentIndex
      });

      previewTimeout = setTimeout(() => {
        console.log('⏲️ Preview timeout reached, advancing to next song');
        
        // Calculate next index
        const nextIndex = (playlistState.currentIndex + 1) % playlistState.items.length;
        const nextSong = playlistState.items[nextIndex];

        if (nextSong && audioDataManager) {
          // Stop current playback
          audioDataManager.pause();
          audioDataManager.cleanup();

          // Load and play next song
          audioDataManager.loadAudio(nextSong.path).then(() => {
            audioDataManager.play();
            
            // Update playlist state
            onPlayModeChange({
              mode: 'preview',
              isPlaying: true,
              currentIndex: nextIndex,
              currentSong: nextSong.songName
            });
          });
        }
      }, PREVIEW_DURATION);
    }

    // Cleanup timeout on unmount or mode change
    return () => {
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
      }
    };
  }, [playlistState.mode, playlistState.isPlaying, currentSong?.songName, playlistState.currentIndex]);

  // Create play mode button
  const playModeButton = (
    <div className="relative inline-flex flex-shrink-0">
      {/* Main Play/Pause/Resume Button */}
      <button
        onClick={() => {
          console.log('🎮 Play button clicked with state:', {
            isPlaying: playlistState.isPlaying,
            hasSong: !!currentSong,
            currentTime: audioData?.playback?.currentTime || 0
          });
          
          if (currentSong && playlistState.isPlaying) {
            console.log('⏸️ Attempting to pause');
            handlePlayPauseResume();
          } else if (currentSong && !playlistState.isPlaying && audioData?.playback?.currentTime && audioData.playback.currentTime > 0) {
            console.log('▶️ Attempting to resume from', audioData.playback.currentTime);
            handlePlayPauseResume(true);
          } else if (currentSong && !playlistState.isPlaying) {
            console.log('▶️ Attempting to resume paused song');
            handlePlayPauseResume(true);
          } else {
            console.log('🎵 Attempting to start new playlist');
            onPlayPlaylist();
          }
        }}
        className={`flex-1 ${buttonContent.baseColor} text-white px-3 sm:px-4 py-1.5 rounded-l transition-colors inline-flex items-center justify-center h-7 sm:h-8 text-xs sm:text-sm min-w-[40px] gap-1`}
        disabled={isBuffering || playbackStats.isTransitioning}
      >
        {debouncedBuffering ? (
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
        ) : (
          buttonContent.icon
        )}
        <span className="hidden sm:inline">{playModeButtonText || buttonContent.text}</span>
      </button>
      
      {/* Dropdown Trigger */}
      <div className="relative">
        <button
          className={`flex items-center justify-center ${buttonContent.baseColor} text-white px-2 py-1.5 rounded-r border-l border-opacity-50 transition-colors h-7 sm:h-8`}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering play
            const select = e.currentTarget.nextElementSibling as HTMLSelectElement;
            select?.click();
          }}
        >
          <ChevronDownIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
        <select
          value={playlistState.mode}
          onChange={(e) => {
            console.log('🔀 Mode dropdown changed:', e.target.value);
            handleModeChange(e.target.value as PlaybackMode);
          }}
          className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
        >
          <option value="normal">Play In Order</option>
          <option value="shuffle">Play Shuffled</option>
          <option value="preview">Preview (10s)</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl mx-auto">
      {/* Hidden Audio Element */}
      <audio 
        className="jukebox-audio hidden"
        preload="auto"
        onPlay={onPlay}
        onPause={onPause}
      >
        Your browser does not support the audio element.
      </audio>

      {/* Player Controls */}
      <div className="flex flex-col space-y-4">
        {/* Title */}
        <h2 className="text-white text-xl font-semibold">
          {currentSong ? currentSong.songName : 'No song selected'}
        </h2>

        {/* Controls Container with Background */}
        <div className="relative bg-gray-800 rounded-2xl p-4">
          {/* Loading Overlay */}
          {debouncedBuffering && (
            <div className="absolute inset-0 bg-gray-800/80 rounded-2xl flex items-center justify-center z-10">
              <ArrowPathIcon className="h-6 w-6 text-blue-400 animate-spin" />
            </div>
          )}

          {/* Controls Row */}
          <div className="flex flex-col space-y-4 relative z-0">
            {/* Top Row: Play/Mode Controls */}
            <div className="flex items-center">
              {/* Play Mode Button */}
              {playModeButton}

              {/* Repeat Toggle - Right after play button */}
              <button
                onClick={() => handleRepeatChange(!playlistState.repeat)}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ml-2 ${
                  playlistState.repeat 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:bg-blue-600/10 hover:text-blue-400'
                }`}
                title={`Repeat Playlist: ${playlistState.repeat ? 'On' : 'Off'}`}
              >
                <ArrowPathIcon className={`h-4 w-4 transition-all ${
                  playlistState.repeat ? 'font-bold' : 'font-normal'
                }`} />
              </button>

              {/* Time Display - After repeat button */}
              <div className="text-gray-400 text-sm ml-4">
                <span>{formatTime(playbackStats.currentTime)}</span>
                <span className="mx-1">/</span>
                <span>{formatTime(playbackStats.duration)}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div 
              className="relative w-full h-2 bg-gray-700 rounded cursor-pointer overflow-hidden"
              onClick={handleSeek}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${(playbackStats.currentTime / playbackStats.duration) * 100}%` }}
              />
              <div
                className="absolute left-0 top-0 h-full bg-blue-300 opacity-50 transition-all duration-200"
                style={{ width: `${bufferProgress}%` }}
              />
              {/* Hover Preview */}
              {isHovering && (
                <>
                  <div 
                    className="absolute h-full bg-blue-400/30"
                    style={{ width: `${hoverPosition}%` }}
                  />
                  <div
                    className="absolute bottom-full mb-1 px-1 py-0.5 bg-gray-900 text-xs text-white rounded transform -translate-x-1/2"
                    style={{ left: `${hoverPosition}%` }}
                  >
                    {formatTime(playbackStats.duration * (hoverPosition / 100))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
