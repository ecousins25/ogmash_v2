import { FC, useEffect, useState, useRef, useCallback } from 'react';
import { AudioDataManager } from './audio-data';
import { PlaylistManager, PlaylistManagerProps } from './playlist';
import { PlaylistBuilder } from './playlist-builder';
import { JukeboxUI } from './UI';
import { AudioData, BufferStrategy } from './audio-data/types';
import { PlaylistState, PlaybackStats, PlaylistItem, PlaybackMode } from './playlist/types';
import { BuilderState, SelectionStep } from './playlist-builder/types';
import { fetchMusicData, SongData } from '../../utils/fetchMusicData';
import { AudioDataMonitor } from './audio-data';

interface PlaylistIndexes {
  currentIndex: number;
  order: number[];  // Stores the play order
}

// Add AudioCallbacks type
interface AudioCallbacks {
  onPlaybackStats: (stats: PlaybackStats) => void;
  onBufferingChange: (isBuffering: boolean) => void;
  onBufferProgress: (progress: number) => void;
  onAudioDataUpdate: (data: AudioData) => void;
  onSongEnd?: () => void;
}

const Jukebox: FC = () => {
  // Audio Data State
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  // Playlist State
  const [playlistState, setPlaylistState] = useState<PlaylistState>({
    items: [],
    currentIndex: 0,
    isPlaying: false,
    mode: 'normal',
    repeat: false,
    transitionTimeoutMs: 1000
  });

  // Update handlePlayModeChange to track mode changes
  const handlePlayModeChange = useCallback((state: Partial<PlaylistState>) => {
    setPlaylistState(prev => ({
      ...prev,
      ...state
    }));
  }, []);

  const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({
    currentTime: 0,
    duration: 0,
    isTransitioning: false,
    nextSongPreloaded: false,
    lastMode: 'normal'
  });

  // Remove playlistManagerRef
  const [playlistManagerProps, setPlaylistManagerProps] = useState<PlaylistManagerProps>({
    items: [],
    mode: 'normal',
    onStateChange: handlePlayModeChange,
    audioDataManager: null,
    repeat: false,
    transitionTimeoutMs: 1000
  });

  // Builder State
  const [builderState, setBuilderState] = useState<BuilderState>({
    availableSongs: [],
    filteredSongs: [],
    selection: {
      songs: new Set(),
      genres: new Set(),
      versions: new Set()
    },
    filterOptions: {
      songNames: [],
      genres: [],
      versions: []
    },
    currentStep: 'welcome'
  });

  const [currentSong, setCurrentSong] = useState<PlaylistItem | null>(null);

  // Add state at the top with other states
  const [audioDataManager, setAudioDataManager] = useState<AudioDataManager | null>(null);

  // Add audioManagerRef at the top with other refs
  const audioManagerRef = useRef<AudioDataManager | null>(null);

  const lastEventSetupRef = useRef<string>('');

  // Ref to store latest playlist state for handleSongEnd
  const playlistStateRef = useRef(playlistState);
  useEffect(() => {
    playlistStateRef.current = playlistState;
  }, [playlistState]);

  // Initialize with available songs only after Get Started
  useEffect(() => {
    // Only fetch when transitioning from 'welcome' to 'songs' step
    if (builderState.currentStep === 'songs' && builderState.availableSongs.length === 0) {
      const loadSongs = async () => {
        const data = await fetchMusicData();
        
        // Extract filter options from the data
        const filterOptions = {
          songNames: Array.from(new Set(data.songList.map((song: SongData) => song.selectedOptions.songName))) as string[],
          genres: Array.from(new Set(data.songList.map((song: SongData) => song.selectedOptions.genre))).filter(Boolean) as string[],
          versions: Array.from(new Set(data.songList.map((song: SongData) => song.selectedOptions.version))).filter(Boolean) as string[]
        };

        setBuilderState(prev => ({
          ...prev,
          availableSongs: data.songList.map((song: SongData) => ({
            id: song.index,
            path: song.path,
            songName: song.selectedOptions.songName,
            genre: song.selectedOptions.genre,
            version: song.selectedOptions.version
          })),
          filterOptions
        }));
      };
      loadSongs();
    }
  }, [builderState.currentStep, builderState.availableSongs.length]);

  const lastLogTimeRef = useRef(0);
  const LOG_INTERVAL = 2000; // 2 seconds

  // Add throttled logging function
  const logIfNeeded = useCallback((message: string, data: any) => {
    const now = Date.now();
    if (now - lastLogTimeRef.current >= LOG_INTERVAL) {
      console.log(message, data);
      lastLogTimeRef.current = now;
    }
  }, []);

  // Memoize state update callbacks
  const onPlaybackStats = useCallback((stats: PlaybackStats) => setPlaybackStats(stats), []);
  const onBufferingChange = useCallback((isBuffering: boolean) => setIsBuffering(isBuffering), []);
  const onBufferProgress = useCallback((progress: number) => setBufferProgress(progress), []);
  const onAudioDataUpdate = useCallback((data: AudioData) => {
    logIfNeeded('📡 Audio state update:', {
      hasData: !!data,
      mode: playlistState.mode,
      currentSong: currentSong?.songName,
      playback: data?.playback ? {
        currentTime: data.playback.currentTime,
        readyState: data.playback.readyState,
        networkState: data.playback.networkState
      } : null
    });
    setAudioData(data);
  }, [playlistState.mode, currentSong, logIfNeeded]);

  // Add logging when audio data changes
  useEffect(() => {
    if (audioData) {
      logIfNeeded('🔄 Jukebox audio data state updated:', {
        mode: playlistState.mode,
        currentSong: currentSong?.songName,
        playback: audioData.playback ? {
          currentTime: audioData.playback.currentTime,
          readyState: audioData.playback.readyState,
          networkState: audioData.playback.networkState
        } : null
      });
    }
  }, [audioData, playlistState.mode, currentSong, logIfNeeded]);

  // Add a ref to track if we've logged the initial mount
  const hasLoggedMount = useRef(false);

  useEffect(() => {
    // Only log mount once
    if (!hasLoggedMount.current) {
      hasLoggedMount.current = true;
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Jukebox initialized');
      }
    }
  }, []);

  // Add ref for tracking previous audio data state
  const prevAudioDataRef = useRef<{
    mode: PlaybackMode;
    currentSong?: string;
    playback: {
      currentTime: number;
    };
  }>();

  // Store callbacks in refs to prevent recreation
  const callbacksRef = useRef<AudioCallbacks>({
    onPlaybackStats,
    onBufferingChange,
    onBufferProgress,
    onAudioDataUpdate,
    onSongEnd: undefined
  });

  // Update callback refs when they change
  useEffect(() => {
    callbacksRef.current = {
      onPlaybackStats,
      onBufferingChange,
      onBufferProgress,
      onAudioDataUpdate,
      onSongEnd: callbacksRef.current?.onSongEnd
    };
  }, [onPlaybackStats, onBufferingChange, onBufferProgress, onAudioDataUpdate]);

  // Create audio data manager only once
  useEffect(() => {
    console.log('🎵 Creating audio manager');
    const manager = new AudioDataManager({
      ...callbacksRef.current,
      onSongEnd: () => {
        // Get latest playlist state
        const state = playlistStateRef.current;
        if (!state.items.length) return;

        // Find the current song's index
        const currentIndex = state.currentIndex;
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (state.mode === 'shuffle') {
          // In shuffle mode, pick a random song excluding the current one
          const availableIndices = Array.from(
            { length: state.items.length },
            (_, i) => i
          ).filter(i => i !== currentIndex);
          
          nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        } else {
          // In normal mode, go to next song or back to start if repeat is on
          nextIndex = (currentIndex + 1) % state.items.length;
        }

        const nextSong = state.items[nextIndex];
        if (!nextSong) return;
        
        const loadAndPlay = async () => {
          try {
            // Set current song before loading
            setCurrentSong(nextSong);
            
            await manager.loadAudio(nextSong.path);
            await manager.play();
            
            // Update both currentSong and currentIndex
            handlePlayModeChange({
              currentSong: nextSong.songName,
              currentIndex: nextIndex,
              isPlaying: true
            });
          } catch (error) {
            console.error('❌ Failed to load next song:', error);
            setCurrentSong(null);
            handlePlayModeChange({
              isPlaying: false,
              currentSong: undefined,
              currentIndex: state.currentIndex // Keep current index on error
            });
          }
        };

        loadAndPlay();
      }
    });

    setAudioDataManager(manager);
    audioManagerRef.current = manager;
    
    return () => {
      console.log('🧹 Cleaning up audio manager');
      if (manager) {
        manager.cleanup();
      }
    };
  }, []); // Empty dependency array since we use refs

  const handleSongLoad = useCallback(async (songId: string) => {
    const manager = audioManagerRef.current;
    if (!manager) return;
    
    try {
      const song = playlistState.items.find(item => item.id === songId);
      if (!song) {
        console.error('❌ Song not found:', songId);
        return;
      }

      console.log('🎵 Loading song:', song.songName);
      await manager.loadAudio(song.path);
      await manager.play();
    } catch (error) {
      console.error('❌ Failed to load song:', error);
    }
  }, [playlistState.items]);

  const handleStepChange = (step: SelectionStep) => {
    setBuilderState(prev => ({
      ...prev,
      currentStep: step
    }));
  };

  const handleResetSelection = () => {
    setBuilderState(prev => ({
      ...prev,
      currentStep: playlistState.items.length > 0 ? 'add-more' : 'welcome',
      selection: {
        songs: new Set(),
        genres: new Set(),
        versions: new Set()
      }
    }));
  };

  const handleRemoveFromSelection = (song: PlaylistItem) => {
    console.log('🗑️ Removing from selection:', song);
    setBuilderState(prev => {
      const newSelection = {
        songs: new Set(prev.selection.songs),
        genres: new Set(prev.selection.genres),
        versions: new Set(prev.selection.versions)
      };

      // Remove the version first
      newSelection.versions.delete(song.version);

      // Check remaining songs with this genre in any version
      const songsWithThisGenre = prev.availableSongs.filter(s => 
        s.id !== song.id && 
        s.genre === song.genre &&
        newSelection.songs.has(s.songName)
      );

      // Check remaining songs with this name in any version
      const songsWithThisName = prev.availableSongs.filter(s => 
        s.id !== song.id && 
        s.songName === song.songName &&
        newSelection.genres.has(s.genre)
      );

      if (songsWithThisGenre.length === 0) {
        newSelection.genres.delete(song.genre);
      }
      if (songsWithThisName.length === 0) {
        newSelection.songs.delete(song.songName);
      }

      // Stay in complete step if we still have valid selections
      const hasValidSelections = newSelection.songs.size > 0 && 
                               newSelection.genres.size > 0 && 
                               newSelection.versions.size > 0;

      return {
        ...prev,
        selection: newSelection,
        currentStep: hasValidSelections ? 'complete' : 'add-more'  // Always go to add-more when selections are empty
      };
    });
  };

  // Update props when needed
  useEffect(() => {
    if (audioDataManager) {
      setPlaylistManagerProps(prev => ({
        ...prev,
        items: playlistState.items,
        mode: playlistState.mode,
        repeat: playlistState.repeat,
        audioDataManager
      }));
    }
  }, [audioDataManager, playlistState.items, playlistState.mode, playlistState.repeat]);

  // Handle playlist start
  const handlePlaylistStart = async () => {
    if (!audioDataManager || !playlistState.items.length) return;
    
    try {
        const firstSong = playlistState.items[0];
        console.log('🎵 Starting playlist with:', firstSong.songName);
        
        // Set current song first
        setCurrentSong(firstSong);
        
        // Then load and play
        await handleSongLoad(firstSong.id);
        
        // Update playlist state
        handlePlayModeChange({
            currentIndex: 0,
            currentSong: firstSong.songName,
            isPlaying: true
        });
    } catch (error) {
        console.error('Failed to start playlist:', error);
        setCurrentSong(null);
        handlePlayModeChange({
            isPlaying: false,
            currentSong: undefined
        });
    }
  };

  const handlePlaylistSongSelect = async (songId: string) => {
    // Find the index of the song in the playlist
    const index = playlistState.items.findIndex(item => item.id === songId);
    if (index === -1) return;

    const selectedSong = playlistState.items[index];
    if (selectedSong && audioDataManager) {
      await audioDataManager.loadAudio(selectedSong.path);
      await audioDataManager.play();
      setCurrentSong(selectedSong);
      handlePlayModeChange({
        currentIndex: index,
        isPlaying: true
      });
    }
  };

  // Consolidate audio data updates
  useEffect(() => {
    if (audioData) {
      const state = {
        hasData: true,
        mode: playlistState.mode,
        currentSong: currentSong?.songName,
        playback: {
          currentTime: audioData.playback.currentTime,
          readyState: audioData.playback.readyState,
          networkState: audioData.playback.networkState
        }
      };

      // Only log significant changes
      if (
        !prevAudioDataRef.current ||
        prevAudioDataRef.current.mode !== state.mode ||
        prevAudioDataRef.current.currentSong !== state.currentSong ||
        Math.abs(prevAudioDataRef.current.playback.currentTime - state.playback.currentTime) >= 1.0
      ) {
        console.log('📡 Audio state update:', state);
        prevAudioDataRef.current = state;
      }
    }
  }, [audioData, playlistState.mode, currentSong]);

  return (
    <div className="jukebox-container">
      <JukeboxUI
        audioData={audioData}
        audioDataManager={audioDataManager}
        playlistState={playlistState}
        playbackStats={playbackStats}
        currentSong={currentSong}
        isBuffering={isBuffering}
        bufferProgress={bufferProgress}
        onPlaylistSongSelect={handlePlaylistSongSelect}
        onPlayPlaylist={handlePlaylistStart}
        onPlayModeChange={handlePlayModeChange}
        builderState={builderState}
        onRemoveSong={(index) => {
          setPlaylistState(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
          }));
        }}
        onSelectionChange={(type, value, selected) => {
          setBuilderState(prev => {
            const newSelection = { ...prev.selection };
            if (selected) {
              newSelection[type as keyof typeof newSelection].add(value);
            } else {
              newSelection[type as keyof typeof newSelection].delete(value);
            }
            return { ...prev, selection: newSelection };
          });
        }}
        onSongSelect={(songId: string) => {
          const song = builderState.availableSongs.find(s => s.id === songId);
          if (song) {
            setPlaylistState(prev => ({
              ...prev,
              items: [...prev.items, song]
            }));
          }
        }}
        onPlay={() => setPlaylistState(prev => ({ ...prev, isPlaying: true }))}
        onPause={() => setPlaylistState(prev => ({ ...prev, isPlaying: false }))}
        onSongLoad={handleSongLoad}
        onStepChange={handleStepChange}
        onResetSelection={handleResetSelection}
        onRemoveFromSelection={handleRemoveFromSelection}
      />
      <PlaylistBuilder
        availableSongs={builderState.availableSongs}
        onSongSelect={(song) => {
          setPlaylistState(prev => ({
            ...prev,
            items: [...prev.items, song]
          }));
        }}
        onSelectionComplete={(songs) => {
          setPlaylistState(prev => ({
            ...prev,
            items: songs
          }));
        }}
      />
      <PlaylistManager
        items={playlistManagerProps.items}
        mode={playlistManagerProps.mode}
        onStateChange={handlePlayModeChange}
        audioDataManager={playlistManagerProps.audioDataManager}
        repeat={playlistManagerProps.repeat}
        transitionTimeoutMs={playlistManagerProps.transitionTimeoutMs}
      />
    </div>
  );
};

export default Jukebox;
