import { PlaylistItem } from '../playlist/types';

export interface FilterOptions {
  songNames: string[];
  genres: string[];
  versions: string[];
}

export interface Selection {
  songs: Set<string>;
  genres: Set<string>;
  versions: Set<string>;
}

export type SelectionStep = 'welcome' | 'songs' | 'genres' | 'versions' | 'complete' | 'add-more';

export interface BuilderState {
  availableSongs: PlaylistItem[];
  filteredSongs: PlaylistItem[];
  selection: Selection;
  filterOptions: FilterOptions;
  currentStep: SelectionStep;
}

export interface BuilderCallbacks {
  onSongSelect: (song: PlaylistItem) => void;
  onSelectionComplete: (songs: PlaylistItem[]) => void;
}
