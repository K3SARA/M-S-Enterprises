import React, { createContext, useContext, useState, useEffect } from 'react';

export type FontSizeLevel = 'compact' | 'standard' | 'large' | 'xlarge' | 'huge';

export interface FontSizePreset {
  id: FontSizeLevel;
  label: string;
  shortLabel: string;
  sizePx: number;
  percentage: number;
}

export const FONT_SIZE_PRESETS: Record<FontSizeLevel, FontSizePreset> = {
  compact: {
    id: 'compact',
    label: 'Compact',
    shortLabel: '90%',
    sizePx: 14,
    percentage: 90
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    shortLabel: '100%',
    sizePx: 15.5,
    percentage: 100
  },
  large: {
    id: 'large',
    label: 'Large',
    shortLabel: '110%',
    sizePx: 17,
    percentage: 110
  },
  xlarge: {
    id: 'xlarge',
    label: 'Extra Large',
    shortLabel: '120%',
    sizePx: 18.5,
    percentage: 120
  },
  huge: {
    id: 'huge',
    label: 'Maximum',
    shortLabel: '130%',
    sizePx: 20,
    percentage: 130
  }
};

export const PRESET_ORDER: FontSizeLevel[] = ['compact', 'standard', 'large', 'xlarge', 'huge'];

interface FontSizeContextType {
  fontSizeLevel: FontSizeLevel;
  preset: FontSizePreset;
  setFontSizeLevel: (level: FontSizeLevel) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const STORAGE_KEY = 'distributor_font_size';

const applyFontSizeToDom = (preset: FontSizePreset) => {
  if (typeof document !== 'undefined') {
    document.documentElement.style.fontSize = `${preset.sizePx}px`;
    document.documentElement.setAttribute('data-font-size', preset.id);
  }
};

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSizeLevel, setFontSizeLevelState] = useState<FontSizeLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as FontSizeLevel;
      if (saved && FONT_SIZE_PRESETS[saved]) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'standard';
  });

  const preset = FONT_SIZE_PRESETS[fontSizeLevel] || FONT_SIZE_PRESETS.standard;

  useEffect(() => {
    applyFontSizeToDom(preset);
  }, [preset]);

  const setFontSizeLevel = (level: FontSizeLevel) => {
    if (!FONT_SIZE_PRESETS[level]) return;
    setFontSizeLevelState(level);
    applyFontSizeToDom(FONT_SIZE_PRESETS[level]);
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // ignore
    }
  };

  const currentIndex = PRESET_ORDER.indexOf(fontSizeLevel);

  const increaseFontSize = () => {
    if (currentIndex < PRESET_ORDER.length - 1) {
      setFontSizeLevel(PRESET_ORDER[currentIndex + 1]);
    }
  };

  const decreaseFontSize = () => {
    if (currentIndex > 0) {
      setFontSizeLevel(PRESET_ORDER[currentIndex - 1]);
    }
  };

  const resetFontSize = () => {
    setFontSizeLevel('standard');
  };

  const canIncrease = currentIndex < PRESET_ORDER.length - 1;
  const canDecrease = currentIndex > 0;

  return (
    <FontSizeContext.Provider
      value={{
        fontSizeLevel,
        preset,
        setFontSizeLevel,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        canIncrease,
        canDecrease
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = (): FontSizeContextType => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};
