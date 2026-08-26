import classicsData from '../data/zhouyi-classics.json';

export interface ClassicLine {
  position: number;
  label: string;
  text: string;
}

export interface HexagramClassic {
  number: number;
  appName: string;
  sourceName: string;
  sourcePage: string;
  sourceRevision: number;
  judgment: string;
  lines: ClassicLine[];
  special?: {
    label: '用九' | '用六';
    text: string;
  };
}

export interface ClassicsSource {
  title: string;
  provider: string;
  indexPage: string;
  indexRevision: number;
  retrievedAt: string;
  sourceStatus: string;
  transcriptionLicense: string;
  licenseUrl: string;
}

const source = classicsData.source satisfies ClassicsSource;
const entries = classicsData.hexagrams as HexagramClassic[];
const byAppName = new Map(entries.map((entry) => [entry.appName, entry]));

export const zhouyiClassics = {
  source,
  entries,
  forHexagram(appName: string): HexagramClassic {
    const entry = byAppName.get(appName);
    if (!entry) throw new Error(`未找到《周易》经文：${appName}`);
    return entry;
  },
};
