export interface SiteConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: {
      main: string;
      secondary: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
  };
  spacing: {
    container: {
      padding: {
        desktop: string;
        mobile: string;
      };
      maxWidth: string;
    };
    gap: {
      small: string;
      medium: string;
      large: string;
    };
  };
  headerBanner: {
    desktop: {
      height: string;
      transform: string;
    };
    mobile: {
      height: string;
      transform: string;
    };
  };
  typography: {
    fontFamily: {
      heading: string;
      body: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      "2xl": string;
      "3xl": string;
    };
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
    full: string;
  };
} 