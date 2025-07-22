import React, { createContext, useContext, useState, useEffect } from 'react';
import textData from '../locales/text.json';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // localStorage에서 저장된 언어 설정 불러오기
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'en';
  });

  const [texts, setTexts] = useState(textData[language] || textData['en']);

  // 언어가 변경될 때마다 texts 업데이트
  useEffect(() => {
    setTexts(textData[language] || textData['en']);
    // localStorage에 언어 설정 저장
    localStorage.setItem('selectedLanguage', language);
  }, [language]);

  // 텍스트 가져오기 함수 (플레이스홀더 지원)
  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = texts;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // 플레이스홀더 치환
    return value.replace(/\{(\w+)\}/g, (match, param) => {
      return params[param] !== undefined ? params[param] : match;
    });
  };

  const changeLanguage = (newLanguage) => {
    if (textData[newLanguage]) {
      setLanguage(newLanguage);
    } else {
      console.warn(`Language not supported: ${newLanguage}`);
    }
  };

  const value = {
    language,
    texts,
    t,
    changeLanguage
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}; 