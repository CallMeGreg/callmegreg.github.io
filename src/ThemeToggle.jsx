import React, { useEffect, useState } from 'react';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#101714' : '#faf9f6'
    );
    try {
      localStorage.setItem('site.theme', theme);
    } catch (error) {
      console.warn('Unable to save the site theme. It will apply for this visit only.', error);
    }
  }, [theme]);

  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;

  return (
    <button
      type="button"
      className="site-theme-toggle"
      onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === 'dark'
          ? <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5a8.5 8.5 0 1 0 9.5 9.5Z" />
          : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
      </svg>
      <span aria-hidden="true">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
