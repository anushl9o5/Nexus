export interface Paper {
  title: string;
  authors: string[];
  year: string;
  summary: string;
  reason: string; // Why was this picked?
  labOrInstitution?: string;
  relevanceScore: number; // 0-100 score indicating strength of correlation
}

export interface ResearchResponse {
  originalPaperContext: string; // Brief confirmation of what paper was understood
  correlatedPapers: Paper[];
  authorContextPapers: Paper[];
}

export enum TabState {
  CORRELATED = 'CORRELATED',
  AUTHOR_CONTEXT = 'AUTHOR_CONTEXT'
}

export interface SearchState {
  isLoading: boolean;
  error: string | null;
  data: ResearchResponse | null;
}