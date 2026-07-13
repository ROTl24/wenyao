export type Confidence = '高' | '中' | '低';

export interface AnalysisClaim {
  text: string;
  evidenceIds: string[];
  confidence: Confidence;
}

export type SixRelation = '父母' | '官鬼' | '妻财' | '子孙' | '兄弟';
export type FiveElement = '木' | '火' | '土' | '金' | '水';

export interface ProfessionalLineReference {
  source: 'visible' | 'hidden';
  lineIndex: number;
  relation: SixRelation;
  ganZhi: string;
}

export interface ProfessionalAnalysis {
  plateFacts: {
    baseHexagram: string;
    changedHexagram: string;
    movingLines: number[];
    monthGanZhi: string;
    dayGanZhi: string;
    voidBranches: string[];
    worldLine: Omit<ProfessionalLineReference, 'source'>;
    responseLine: Omit<ProfessionalLineReference, 'source'>;
  };
  useGodSelection: {
    primary: ProfessionalLineReference;
    reason: string;
    secondaryRelations: SixRelation[];
    alternatives: Array<ProfessionalLineReference & { reason: string }>;
  };
  spiritRoles: Record<'original' | 'taboo' | 'enemy', {
    element: FiveElement;
    relation: SixRelation;
    lineRefs: ProfessionalLineReference[];
    assessment: string;
  }>;
  interactionChecks: Array<{
    leftLineIndex: number;
    rightLineIndex: number;
    leftGanZhi: string;
    rightGanZhi: string;
    leftBranch: string;
    rightBranch: string;
    leftElement: FiveElement;
    rightElement: FiveElement;
    leftRelation: SixRelation;
    rightRelation: SixRelation;
    leftRole: '' | '世' | '应';
    rightRole: '' | '世' | '应';
    elementRelation: '比和' | '左生右' | '右生左' | '左克右' | '右克左' | '未知';
    branchRelation: '六合' | '六冲' | '无';
    factStatement: string;
    interpretation: string;
  }>;
}

export interface AnalysisReport {
  mode: 'cloud' | 'local';
  summary: string;
  focus: string;
  relations: string;
  moving: string;
  synthesis: string;
  uncertainties: string[];
  guidance: string[];
  claims: AnalysisClaim[];
  professional?: ProfessionalAnalysis;
  generatedAt: string;
  pipeline?: {
    retrievalMode: 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';
    factCheckPassed: boolean;
    citationCheckPassed: boolean;
    stages: string[];
    warnings: string[];
  };
}
