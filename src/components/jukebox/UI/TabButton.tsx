import { FC } from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const TabButton: FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium rounded-t-lg transition-colors
        ${isActive 
          ? 'bg-gray-900 text-green-400 border-t border-x border-gray-700' 
          : 'bg-gray-800 text-gray-400 hover:text-green-400'}`}
    >
      {label}
    </button>
  );
};
