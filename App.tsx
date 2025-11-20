
import React, { useState, useRef, useEffect } from 'react';
import { analyzePaper, getPaperSuggestions } from './services/geminiService';
import { SearchState, TabState, Paper } from './types';
import PaperCard from './components/PaperCard';
import GraphView from './components/GraphView';
import { SearchIcon, AnimatedBookIcon, BookOpenIcon, UsersIcon, ArrowRightIcon, NetworkIcon, ListIcon, PlusIcon, SparklesIcon } from './components/Icons';

type ViewMode = 'LIST' | 'GRAPH';

export default function App() {
  const [query, setQuery] = useState('');
  // We now track a list of papers that form the "Context" of the search
  const [contextPapers, setContextPapers] = useState<Paper[]>([]);
  
  const [state, setState] = useState<SearchState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [activeTab, setActiveTab] = useState<TabState>(TabState.CORRELATED);
  const [viewMode, setViewMode] = useState<ViewMode>('GRAPH'); // Default to Graph
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  
  // Ref to prevent suggestion fetch loop when selecting an item
  const skipSuggestionFetch = useRef(false);

  useEffect(() => {
    // If we just selected a suggestion, don't trigger a new search immediately
    if (skipSuggestionFetch.current) {
      skipSuggestionFetch.current = false;
      return;
    }

    const debounceTimer = setTimeout(async () => {
      if (query.trim().length >= 3) {
        setIsFetchingSuggestions(true);
        try {
          const results = await getPaperSuggestions(query);
          setSuggestions(results);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Failed to fetch suggestions", error);
        } finally {
          setIsFetchingSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 600); 

    return () => clearTimeout(debounceTimer);
  }, [query]); // Removed state.isLoading to prevent re-opening dropdown when search completes

  const executeSearch = async (papers: Paper[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const paperTitles = papers.map(p => p.title);
      const result = await analyzePaper(paperTitles);
      
      setState({
        isLoading: false,
        error: null,
        data: result,
      });

      // Scroll to top when results load
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setState({
        isLoading: false,
        error: "Failed to analyze. Please check your connection and try again.",
        data: null,
      });
    }
  };

  const handleInitialSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setShowSuggestions(false);
    setSuggestions([]);

    // Create a partial "Paper" object for the root from the query
    const initialRoot: Paper = {
      title: query,
      authors: [], 
      year: '', 
      summary: 'Initial Query', 
      reason: 'Root', 
      relevanceScore: 100 
    };

    const newContext = [initialRoot];
    setContextPapers(newContext);
    await executeSearch(newContext);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    skipSuggestionFetch.current = true; // Skip the next useEffect fetch to prevent re-opening
    setQuery(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddToContext = async (paper: Paper) => {
    // Prevent adding duplicates
    if (contextPapers.some(p => p.title === paper.title)) return;
    
    const newContext = [...contextPapers, paper];
    setContextPapers(newContext);
    await executeSearch(newContext);
  };

  // Determine if we are in the "Landing Page" state
  const isLanding = !state.data && !state.isLoading && !state.error;

  const renderResults = () => {
    if (state.isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative w-20 h-20">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-[#5f6368] rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-[#e8eaed] rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-[#9aa0a6] animate-pulse font-medium">
             {contextPapers.length > 1 ? 'Synthesizing cluster connections...' : 'Analyzing literature graph...'}
          </p>
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="bg-[#3c4043] border border-[#5f6368] text-[#e8eaed] p-6 rounded-xl text-center max-w-md mx-auto mt-10">
          <p className="font-semibold text-white">Oops!</p>
          <p className="text-[#9aa0a6]">{state.error}</p>
        </div>
      );
    }

    if (!state.data) return null;

    const papersToShow = activeTab === TabState.CORRELATED 
      ? state.data.correlatedPapers 
      : state.data.authorContextPapers;

    return (
      <div ref={resultsRef} className="animate-fade-in pb-20">
        {/* Context Header */}
        <div className="mb-8 bg-[#303134] text-[#e8eaed] rounded-2xl p-6 shadow-lg relative overflow-hidden border border-[#5f6368]/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.02] rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#9aa0a6] mb-2">
            {contextPapers.length > 1 ? 'Cluster Analysis' : 'Analyzed Subject'}
          </h2>
          <p className="text-xl md:text-2xl font-serif font-medium leading-snug text-white">
            {state.data.originalPaperContext}
          </p>
          
          {contextPapers.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
               {contextPapers.map((p, i) => (
                 <span key={i} className="text-xs bg-[#202124] border border-[#5f6368] px-2 py-1 rounded-lg text-[#9aa0a6]">
                   {p.title}
                 </span>
               ))}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 sticky top-4 z-30">
          {/* Tabs */}
          <div className="bg-[#303134]/90 backdrop-blur-md p-1.5 rounded-xl flex shadow-sm border border-[#5f6368]/30 w-full md:w-auto">
            <button
              onClick={() => setActiveTab(TabState.CORRELATED)}
              className={`flex-1 md:flex-none flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === TabState.CORRELATED
                  ? 'bg-[#e8eaed] text-[#202124] shadow-sm'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
              }`}
            >
              <BookOpenIcon className="w-4 h-4 mr-2" />
              Correlated Work
            </button>
            <button
              onClick={() => setActiveTab(TabState.AUTHOR_CONTEXT)}
              className={`flex-1 md:flex-none flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === TabState.AUTHOR_CONTEXT
                  ? 'bg-[#e8eaed] text-[#202124] shadow-sm'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
              }`}
            >
              <UsersIcon className="w-4 h-4 mr-2" />
              Author Context
            </button>
          </div>

          {/* View Toggle */}
          <div className="bg-[#303134]/90 backdrop-blur-md p-1.5 rounded-xl flex shadow-sm border border-[#5f6368]/30">
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'LIST'
                  ? 'bg-[#e8eaed] text-[#202124] shadow-sm'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
              title="List View"
            >
              <ListIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('GRAPH')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'GRAPH'
                  ? 'bg-[#e8eaed] text-[#202124] shadow-sm'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
              title="Graph View"
            >
              <NetworkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Render */}
        {viewMode === 'LIST' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
            {papersToShow.map((paper, idx) => (
              <div key={idx} className="relative group">
                <PaperCard paper={paper} index={idx} />
                 {/* Hover Add Button for List View as well */}
                 <button 
                    onClick={() => handleAddToContext(paper)}
                    className="absolute top-4 right-4 bg-[#202124] text-[#e8eaed] border border-[#5f6368] p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-[#303134] hover:scale-110 hover:border-[#e8eaed]"
                    title="Add to analysis context"
                 >
                   <PlusIcon className="w-4 h-4" />
                 </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#202124] rounded-2xl border border-[#5f6368]/30 shadow-inner min-h-[500px] flex items-center justify-center overflow-hidden animate-fade-in relative">
             <GraphView 
               rootPapers={contextPapers}
               papers={papersToShow}
               type={activeTab === TabState.CORRELATED ? 'correlated' : 'author'}
               onAddToContext={handleAddToContext}
             />
          </div>
        )}
        
        <div className="mt-12 text-center text-[#9aa0a6] text-xs">
          AI-generated results. Verify details on Google Scholar.
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#202124] text-[#e8eaed]">
      {/* Navbar */}
      <header className="bg-[#202124] sticky top-0 z-50 pt-4">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => {
              setContextPapers([]);
              setState({ isLoading: false, error: null, data: null });
              setQuery('');
          }}>
            <BookOpenIcon className="w-6 h-6 text-[#e8eaed]" />
            <span className="text-xl font-bold text-[#e8eaed] tracking-tight">ResearchNexus</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col relative">
        
        {/* Landing Page "Start Discovery" Background */}
        {isLanding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-40 pointer-events-none select-none z-0">
            {/* Sparkle Animation Restored */}
            <div className="mb-6 text-[#5f6368]">
              <SparklesIcon className="w-24 h-24 animate-fidget-spin" />
            </div>
            <h2 className="text-2xl font-bold text-[#9aa0a6]">Start your discovery</h2>
            <p className="text-[#5f6368] mt-2 text-center max-w-md px-4">Enter a paper title to map its connections.</p>
          </div>
        )}

        {/* Main Layout Container 
            - If isLanding: flex-grow pushes content to bottom (justify-end)
            - If results: Standard flow (pt-8)
        */}
        <div className={`max-w-4xl mx-auto w-full px-4 flex flex-col transition-all duration-500 ${isLanding ? 'flex-grow justify-end pb-12' : 'pt-8'}`}>
          
          {/* Search Bar Area */}
          <div className="relative z-40 w-full max-w-2xl mx-auto">
            <form onSubmit={handleInitialSearch} className="relative z-10">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="h-6 w-6 text-[#9aa0a6] group-focus-within:text-[#e8eaed] transition-colors" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.length < 3) setShowSuggestions(false);
                }}
                onFocus={() => {
                  if (suggestions.length > 0 && query.length >= 3) setShowSuggestions(true);
                }}
                placeholder="e.g. Attention Is All You Need"
                className="block w-full pl-12 pr-16 py-4 bg-[#303134] text-[#e8eaed] border-2 border-transparent rounded-2xl text-lg placeholder-[#9aa0a6] focus:outline-none focus:border-[#e8eaed] focus:ring-4 focus:ring-[#e8eaed]/10 transition-all shadow-xl shadow-black/20"
              />
              <button
                type="submit"
                disabled={state.isLoading || !query.trim()}
                className="absolute right-2 top-2 bottom-2 bg-[#e8eaed] hover:bg-white text-[#202124] px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {state.isLoading ? (
                  <span className="w-5 h-5 border-2 border-[#202124]/30 border-t-[#202124] rounded-full animate-spin"></span>
                ) : (
                  <ArrowRightIcon className="w-5 h-5" />
                )}
              </button>
            </form>

            {/* Autocomplete Dropdown */}
            {(showSuggestions || isFetchingSuggestions) && query.length >= 3 && (
              <div className={`absolute left-0 right-0 bg-[#303134] rounded-xl border border-[#5f6368]/50 shadow-xl overflow-hidden animate-fade-in-up z-50 ${isLanding ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                {isFetchingSuggestions && suggestions.length === 0 && (
                  <div className="p-4 text-center text-[#9aa0a6] text-sm flex items-center justify-center">
                      <span className="w-4 h-4 border-2 border-[#e8eaed] border-t-transparent rounded-full animate-spin mr-2"></span>
                      Finding papers...
                  </div>
                )}
                
                {!isFetchingSuggestions && suggestions.length === 0 && (
                  <div className="p-4 text-center text-[#9aa0a6] text-sm">
                      No suggestions found.
                  </div>
                )}

                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="w-full text-left px-4 py-3 text-[#e8eaed] hover:bg-[#3c4043] transition-colors border-b border-[#5f6368]/30 last:border-0 flex items-center group"
                  >
                    <BookOpenIcon className="w-4 h-4 mr-3 text-[#9aa0a6] group-hover:text-[#e8eaed]" />
                    <span className="truncate font-medium">{suggestion}</span>
                  </button>
                ))}
                
                {suggestions.length > 0 && (
                  <div className="px-4 py-2 bg-[#202124] text-right text-[10px] text-[#9aa0a6] uppercase tracking-wider font-bold">
                    Suggestions
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Section (Only renders if not landing) */}
          {!isLanding && (
            <div className="mt-8 w-full">
              {renderResults()}
            </div>
          )}

        </div>
      </main>
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.2s ease-out forwards;
        }
        
        /* Fidget Spinner Style Animation: Rapid acceleration/deceleration */
        @keyframes fidget-spin {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(0deg); }
          50% { transform: rotate(360deg); }
          90% { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }

        .animate-fidget-spin {
          /* Sharp curve for acceleration feeling */
          animation: fidget-spin 2.5s cubic-bezier(0.85, 0, 0.15, 1) infinite;
        }
      `}</style>
    </div>
  );
}
