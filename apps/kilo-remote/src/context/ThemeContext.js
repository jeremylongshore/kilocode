import React, { createContext, useState, useMemo } from 'react';
import { darkTheme, lightTheme } from '../styles/theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isVerbose, setIsVerbose] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState(null);

  const theme = useMemo(() => (isDarkMode ? darkTheme : lightTheme), [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleVerbose = () => {
    setIsVerbose(!isVerbose);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, isVerbose, toggleVerbose, expandedMessageId, setExpandedMessageId }}>
      {children}
    </ThemeContext.Provider>
  );
};