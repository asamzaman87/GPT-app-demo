import { useState, useEffect } from 'react';
import type { OpenAIWidget } from './types';

export function useOpenAI<T = unknown>() {
  const [openai, setOpenai] = useState<OpenAIWidget | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOpenAI = () => {
      if (window.openai) {
        setOpenai(window.openai);
        setData(window.openai.toolOutput as T);
        setTheme(window.openai.theme || 'light');
        setIsLoading(false);
      } else {
        setTimeout(checkOpenAI, 100);
      }
    };

    checkOpenAI();
  }, []);

  const callTool = async (name: string, args: Record<string, unknown>) => {
    if (!openai) throw new Error('OpenAI not initialized');
    return openai.callTool(name, args);
  };

  const openExternal = (url: string) => {
    if (openai) {
      openai.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const sendFollowUp = (message: string) => {
    if (openai) {
      openai.sendFollowUpMessage(message);
    }
  };

  const notifyHeight = () => {
    if (openai) {
      openai.notifyIntrinsicHeight(document.body.scrollHeight);
    }
  };

  return {
    openai,
    data,
    theme,
    isLoading,
    callTool,
    openExternal,
    sendFollowUp,
    notifyHeight,
  };
}

