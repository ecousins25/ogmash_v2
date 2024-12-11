import { useMemo } from 'react';
import siteConfig from '../styles/site-config.json';
import type { SiteConfig } from '../styles/site-config';

export const useSiteConfig = () => {
  const config = useMemo<SiteConfig>(() => siteConfig, []);
  return config;
};

// Helper function to get nested values using dot notation
export const getConfigValue = (path: string): string => {
  return path.split('.').reduce((obj: any, key) => obj?.[key], siteConfig) as string;
}; 