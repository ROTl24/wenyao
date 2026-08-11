/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';
import calendarStyles from './components/CalendarScreen.css?raw';
import corpusStyles from './components/CorpusLibraryPanel.css?raw';
import resultStyles from './components/ResultScreen.css?raw';
import globalStyles from './styles.css?raw';

const styleSheets = {
  'styles.css': globalStyles,
  'CalendarScreen.css': calendarStyles,
  'CorpusLibraryPanel.css': corpusStyles,
  'ResultScreen.css': resultStyles,
};

function undersizedFontDeclarations(css: string) {
  return Array.from(css.matchAll(/(?:font-size|font)\s*:\s*([^;{}]+)/g))
    .map((match) => match[1])
    .filter((declaration) => {
      const pixelSize = declaration.match(/(?<![\d.])(\d+(?:\.\d+)?)px\b/);
      return pixelSize !== null && Number(pixelSize[1]) < 12;
    });
}

describe('typography contract', () => {
  it('defines distinct UI, reading, display, and ritual font roles', () => {
    expect(globalStyles).toContain('--font-ui:');
    expect(globalStyles).toContain('--font-reading:');
    expect(globalStyles).toContain('--font-display:');
    expect(globalStyles).toContain('--font-ritual:');
    expect(globalStyles).toMatch(/--font-reading:\s*"Microsoft YaHei"/);
    expect(globalStyles).toMatch(/--font-display:\s*"Zhuque Fangsong"/);
  });

  it('keeps all explicit user-facing font sizes at or above 12px', () => {
    for (const [file, css] of Object.entries(styleSheets)) {
      expect(undersizedFontDeclarations(css), file).toEqual([]);
    }
  });

  it('uses the reading font for long-form analysis, evidence, and chat copy', () => {
    expect(resultStyles).toMatch(
      /\.markdown-content\s*\{[^}]*font:[^;]*var\(--result-reading\)/s,
    );
    expect(resultStyles).toMatch(/\.evidence-text\s*\{[^}]*var\(--result-reading\)/s);
    expect(resultStyles).toMatch(
      /\.chat-message-copy\s*>\s*p\s*\{[^}]*var\(--result-reading\)/s,
    );
  });
});
