import { PlaylistState, PlaylistItem, PlaybackMode } from './types';
import { Component, useEffect, useCallback } from 'react';
import { AudioDataManager } from '../audio-data';
import React from 'react';

const PREVIEW_DURATION = 10000; // 10 seconds for preview mode

export interface PlaylistManagerProps {
  items: PlaylistItem[];
  mode?: PlaybackMode;
  onStateChange: (state: PlaylistState) => void;
  audioDataManager: AudioDataManager | null;
  repeat?: boolean;
  transitionTimeoutMs?: number;
}

export class PlaylistManager extends Component<PlaylistManagerProps, PlaylistState> {
  private previewTimeout: NodeJS.Timeout | null = null;
  private shuffleOrder: number[] = [];
  private mounted: boolean = false;
  private initializationTime: number;
  private items: PlaylistItem[] = [];
  private currentIndex: number = 0;
  private mode: PlaybackMode = 'normal';
  private isPlaying: boolean = false;
  private repeat: boolean = false;

  constructor(props: PlaylistManagerProps) {
    super(props);
    this.initializationTime = Date.now();

    // Initialize state in constructor
    this.state = {
      items: props.items || [],
      currentIndex: 0,
      isPlaying: false,
      mode: props.mode || 'normal',
      repeat: props.repeat || false,
      transitionTimeoutMs: props.transitionTimeoutMs || 1000,
      currentSong: undefined
    };

    // Bind methods
    this.updateState = this.updateState.bind(this);
    this.handleSongEnd = this.handleSongEnd.bind(this);
    this.startPlaylist = this.startPlaylist.bind(this);
    this.stopPlaylist = this.stopPlaylist.bind(this);
    this.playNext = this.playNext.bind(this);
    this.playPrevious = this.playPrevious.bind(this);
    this.jumpToIndex = this.jumpToIndex.bind(this);
    this.handleRepeatChange = this.handleRepeatChange.bind(this);
    this.handleModeChange = this.handleModeChange.bind(this);
  }

  public componentDidMount(): void {
    this.mounted = true;
    
    // Initialize shuffle mode if needed
    if (this.state.mode === 'shuffle') {
      this.initializeShuffleOrder();
    }
    
    // Notify parent of initial state
    this.props.onStateChange(this.state);
  }

  public componentWillUnmount(): void {
    if (this.state.items.length > 0) {
      console.log('🎮 Playlist cleanup:', {
        songs: this.state.items.length,
        currentSong: this.state.currentSong,
        mode: this.state.mode
      });
    }
    this.mounted = false;
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }

  private async updateState(newState: Partial<PlaylistState>): Promise<void> {
    if (!this.mounted) return;

    const currentState = this.state;
    const updatedState = { ...currentState, ...newState };

    console.log('📝 Playlist state update:', {
      function: 'updateState',
      previous: {
        mode: currentState.mode,
        currentIndex: currentState.currentIndex,
        currentSong: currentState.currentSong,
        isPlaying: currentState.isPlaying
      },
      new: {
        mode: updatedState.mode,
        currentIndex: updatedState.currentIndex,
        currentSong: updatedState.currentSong,
        isPlaying: updatedState.isPlaying
      },
      isReset: updatedState.currentIndex === 0 && !updatedState.isPlaying
    });

    await new Promise<void>((resolve) => {
      this.setState(updatedState, resolve);
    });
  }

  handleSongEnd = async () => {
    if (!this.mounted) {
      console.log('🎮 Ignoring song end - component not mounted');
      return;
    }

    let nextIndex = this.state.currentIndex;
    if (this.state.mode === 'shuffle') {
      nextIndex = this.getNextShuffleIndex();
    } else {
      // In normal mode, handle repeat
      if (this.state.currentIndex >= this.state.items.length - 1) {
        // At the end of playlist
        if (this.state.repeat) {
          nextIndex = 0; // Start from beginning if repeat is on
        } else {
          // Stop playback if repeat is off and we're at the end
          this.stopPlaylist();
          return;
        }
      } else {
        nextIndex = this.state.currentIndex + 1;
      }
    }

    const nextSong = this.state.items[nextIndex];
    if (nextSong && this.mounted) {
      console.log('🎮 Transitioning to next song:', {
        prevIndex: this.state.currentIndex,
        nextIndex,
        nextSong: nextSong.songName,
        repeat: this.state.repeat
      });

      // Update state first
      await this.updateState({
        currentIndex: nextIndex,
        currentSong: nextSong.songName,
        isPlaying: true // Ensure playing state is maintained
      });

      // Then load and play the audio
      if (this.props.audioDataManager && this.mounted) {
        await this.props.audioDataManager.loadAudio(nextSong.path);
        if (this.mounted) {
          await this.props.audioDataManager.play();
        }
      }
    }
  };

  startPlaylist = async (options?: { mode?: PlaybackMode; repeat?: boolean }): Promise<PlaylistItem | null> => {
    const mode = options?.mode || this.state.mode;
    const repeat = options?.repeat ?? this.state.repeat;
    
    if (!this.props.audioDataManager || !this.state.items.length) {
      return null;
    }

    const firstSong = this.getNextSong();
    if (!firstSong) return null;

    await this.props.audioDataManager.loadAudio(firstSong.path);
    await this.props.audioDataManager.play();
    
    await this.updateState({
      mode,
      repeat,
      isPlaying: true,
      currentSong: firstSong.songName.toLowerCase()
    });

    return firstSong;
  };

  stopPlaylist = () => {
    if (this.props.audioDataManager) {
      this.props.audioDataManager.pause();
      this.props.audioDataManager.cleanup();
    }
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.updateState({ isPlaying: false });
  };

  playNext = async () => {
    return this.handleSongEnd();
  };

  playPrevious = async () => {
    if (!this.mounted) return;
    let newIndex = this.state.currentIndex - 1;
    if (newIndex < 0) {
      newIndex = this.state.items.length - 1;
    }
    await this.updateState({ currentIndex: newIndex });
  };

  jumpToIndex = async (index: number): Promise<PlaylistItem | null> => {
    if (index < 0 || index >= this.state.items.length) return null;

    // Update state with new index and song
    const song = this.state.items[index];
    await this.updateState({
      currentIndex: index,
      currentSong: song.songName,
      isPlaying: true
    });

    // If in shuffle mode, adjust shuffle order to continue from this song
    if (this.state.mode === 'shuffle') {
      // Find where this index is in the shuffle order
      const shuffleIndex = this.shuffleOrder.indexOf(index);
      if (shuffleIndex !== -1) {
        // Move all items before this one to the end of the shuffle order
        this.shuffleOrder = [
          ...this.shuffleOrder.slice(shuffleIndex),
          ...this.shuffleOrder.slice(0, shuffleIndex)
        ];
      }
    }

    // Load and play the audio
    if (song && this.props.audioDataManager) {
      await this.props.audioDataManager.loadAudio(song.path);
      await this.props.audioDataManager.play();
      return song;
    }
    return null;
  };

  handleRepeatChange = (repeat: boolean) => {
    this.updateState({ repeat });
  };

  handleModeChange = (newMode: PlaybackMode) => {
    console.log('🔄 Playlist mode change:', {
      from: this.state.mode,
      to: newMode,
      currentSong: this.state.currentSong,
      totalSongs: this.state.items.length
    });

    // Stop current playback and reset audio state
    if (this.props.audioDataManager) {
      this.props.audioDataManager.pause();
      this.props.audioDataManager.cleanup();
    }

    // Initialize shuffle order if switching to shuffle mode
    if (newMode === 'shuffle') {
      this.initializeShuffleOrder();
      console.log('🔀 Created shuffle order:', this.shuffleOrder);
      
      // Start playing first song in shuffle order
      const firstIndex = this.shuffleOrder[0];
      const firstSong = this.state.items[firstIndex];
      
      this.updateState({
        mode: newMode,
        isPlaying: false,
        currentIndex: firstIndex,
        currentSong: firstSong.songName
      });

      // Load and play the first song
      if (this.props.audioDataManager && firstSong) {
        this.props.audioDataManager.loadAudio(firstSong.path);
      }
    } else {
      // Reset to normal mode
      this.updateState({
        mode: newMode,
        isPlaying: false,
        currentIndex: 0,
        currentSong: this.state.items[0]?.songName
      });
    }

    // After a short delay, start preview mode if needed
    setTimeout(() => {
      if (newMode === 'preview') {
        this.startPlaylist({ mode: 'preview' });
      }
    }, 100);
  };

  private initializeShuffleOrder = (): void => {
    this.shuffleOrder = Array.from({ length: this.state.items.length }, (_, i) => i);
    for (let i = this.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleOrder[i], this.shuffleOrder[j]] = [this.shuffleOrder[j], this.shuffleOrder[i]];
    }
  };

  private getNextShuffleIndex = (): number => {
    const currentShuffleIndex = this.shuffleOrder.findIndex(i => i === this.state.currentIndex);
    const nextShuffleIndex = (currentShuffleIndex + 1) % this.shuffleOrder.length;
    return this.shuffleOrder[nextShuffleIndex];
  };

  private getNextSong = (): PlaylistItem | null => {
    if (!this.state.items.length) return null;

    switch (this.state.mode) {
      case 'shuffle':
        if (this.shuffleOrder.length === 0) {
          this.initializeShuffleOrder();
        }
        const shuffleIndex = this.shuffleOrder[this.state.currentIndex];
        return this.state.items[shuffleIndex] || null;

      case 'preview':
      case 'normal':
      default:
        return this.state.items[this.state.currentIndex] || null;
    }
  };

  render() {
    return null;
  }
}
