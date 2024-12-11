import { FC, useEffect, useState, useCallback } from 'react';
import { PlaylistItem } from '../playlist/types';
import { BuilderState, Selection, BuilderCallbacks, SelectionStep } from './types';
import { filterSongs, extractFilterOptions } from './utils';

interface PlaylistBuilderProps extends BuilderCallbacks {
  availableSongs: PlaylistItem[];
}

export const PlaylistBuilder: FC<PlaylistBuilderProps> = ({
  availableSongs,
  onSongSelect,
  onSelectionComplete
}) => {
  const [builderState, setBuilderState] = useState<BuilderState>({
    availableSongs: [],
    filteredSongs: [],
    selection: {
      songs: new Set<string>(),
      genres: new Set<string>(),
      versions: new Set<string>()
    },
    filterOptions: {
      songNames: [],
      genres: [],
      versions: []
    },
    currentStep: 'welcome' as SelectionStep
  });

  // Initialize builder with available songs
  useEffect(() => {
    const filterOptions = {
      songNames: Array.from(new Set(availableSongs.map(song => song.songName))),
      genres: Array.from(new Set(availableSongs.map(song => song.genre))).filter(Boolean),
      versions: Array.from(new Set(availableSongs.map(song => song.version))).filter(Boolean)
    };

    setBuilderState(prev => ({
      ...prev,
      availableSongs,
      filteredSongs: availableSongs,
      filterOptions
    }));
  }, [availableSongs]);

  // Update filtered songs when selection changes
  useEffect(() => {
    const filtered = filterSongs(builderState.availableSongs, builderState.selection);
    setBuilderState(prev => ({
      ...prev,
      filteredSongs: filtered
    }));
  }, [builderState.selection, builderState.availableSongs]);

  const updateSelection = useCallback((
    type: keyof Selection,
    value: string,
    selected: boolean
  ) => {
    setBuilderState(prev => {
      const newSelection = { ...prev.selection };
      if (selected) {
        newSelection[type].add(value);
      } else {
        newSelection[type].delete(value);
      }
      return { ...prev, selection: newSelection };
    });
  }, []);

  const handleSongSelect = useCallback((song: PlaylistItem) => {
    onSongSelect(song);
  }, [onSongSelect]);

  const completeSelection = useCallback(() => {
    onSelectionComplete(builderState.filteredSongs);
  }, [builderState.filteredSongs, onSelectionComplete]);

  return null; // Logic-only component
};
