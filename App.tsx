
import React, { useState, useRef, useEffect } from 'react';
import { analyzePaper, getPaperSuggestions } from './services/geminiService';
import { SearchState, TabState, Paper } from './types';
import PaperCard from './components/PaperCard';
import GraphView from './components/GraphView';
import { SearchIcon, AnimatedBookIcon, BookOpenIcon, UsersIcon, ArrowRightIcon, NetworkIcon, ListIcon, PlusIcon, SparklesIcon, ChevronDownIcon, HistoryIcon, ChevronLeftIcon, ChevronRightIcon } from './components/Icons';

type ViewMode = 'LIST' | 'GRAPH';

export default function App() {
  const [query, setQuery] = useState('');
  // We now track a list of papers that form the "Context" of the search
  const [contextPapers, setContextPapers] = useState<Paper[]>([]);
  
  // History State: Stores arrays of Paper[] (previous contexts)
  const [searchHistory, setSearchHistory] = useState<Paper[][]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [state, setState] = useState<SearchState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [activeTab, setActiveTab] = useState<TabState>(TabState.CORRELATED);
  const [viewMode, setViewMode] = useState<ViewMode>('GRAPH'); // Default to Graph
  
  // List View (Carousel) State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  
  // Dropdown state for the context summary
  const [isContextExpanded, setIsContextExpanded] = useState(false);

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

  // Reset card index when tab or data changes
  useEffect(() => {
    setCurrentCardIndex(0);
  }, [activeTab, state.data]);

  const addToHistory = (newContext: Paper[]) => {
    setSearchHistory(prev => {
      // Avoid exact duplicate of the immediate previous search to keep history clean
      if (prev.length > 0) {
        const lastParams = prev[0].map(p => p.title).sort().join('|');
        const newParams = newContext.map(p => p.title).sort().join('|');
        if (lastParams === newParams) return prev;
      }
      const updated = [newContext, ...prev];
      return updated.slice(0, 5); // Keep max 5
    });
  };

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

  const handleRestoreHistory = async (historyContext: Paper[]) => {
    setIsHistoryOpen(false);
    setContextPapers(historyContext);
    // Update query to reflect the primary paper of that history state for clarity
    if (historyContext.length > 0) {
        setQuery(historyContext[0].title);
        skipSuggestionFetch.current = true; 
    }
    await executeSearch(historyContext);
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
    addToHistory(newContext); // Add to history
    setContextPapers(newContext);
    await executeSearch(newContext);
  };

  const handleNewSearch = async (paper: Paper) => {
    skipSuggestionFetch.current = true; // Prevent autocomplete popup
    setQuery(paper.title);
    setSuggestions([]);
    setShowSuggestions(false);

    const newContext = [paper];
    addToHistory(newContext); // Add to history
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
    addToHistory(newContext); // Add to history
    setContextPapers(newContext);
    await executeSearch(newContext);
  };

  // --- Carousel Logic ---
  const handleNextCard = () => {
    const papersToShow = activeTab === TabState.CORRELATED 
      ? state.data?.correlatedPapers || []
      : state.data?.authorContextPapers || [];
      
    if (currentCardIndex < papersToShow.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) handleNextCard();
    if (isRightSwipe) handlePrevCard();
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
             {contextPapers.length > 1 ? 'Synthesizing...' : 'Analyzing literature graph...'}
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

    // Dynamically generate the context summary title
    const contextTitle = contextPapers.length > 0
      ? `Summary of ${contextPapers.map(p => p.title).join(', ')}`
      : 'Summary of Analyzed Subject';

    return (
      <div ref={resultsRef} className="animate-fade-in pb-20">
        
        {/* Context Dropdown (Collapsible Accordion) */}
        <div className="mb-6 bg-[#303134] text-[#e8eaed] rounded-xl shadow-sm border border-[#5f6368]/30 overflow-hidden transition-all duration-300">
          <button 
            onClick={() => setIsContextExpanded(!isContextExpanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[#3c4043] transition-colors group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
               <div className="p-1.5 bg-[#202124] rounded-lg text-[#9aa0a6] shrink-0 group-hover:text-[#e8eaed] transition-colors">
                 <BookOpenIcon className="w-4 h-4" />
               </div>
               <span className="font-medium text-sm md:text-base truncate text-[#e8eaed] pr-4">
                 {contextTitle}
               </span>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-[#9aa0a6] transition-transform duration-300 shrink-0 ${isContextExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Expanded Content */}
          <div className={`bg-[#202124]/50 border-t border-[#5f6368]/30 transition-all duration-300 ease-in-out ${isContextExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
             <div className="p-4 md:p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">
                    {contextPapers.length > 1 ? 'Cluster Analysis' : 'Core Theme'}
                </h3>
                <p className="text-lg font-serif leading-relaxed text-white">
                   {state.data.originalPaperContext}
                </p>
             </div>
          </div>
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
          <div 
            className="flex flex-col items-center min-h-[450px] animate-fade-in-up"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="relative w-full max-w-lg">
              
              {/* Stack Effect (Background Card) */}
              {currentCardIndex < papersToShow.length - 1 && (
                <div className="absolute top-6 left-6 right-6 bottom-0 bg-[#303134] opacity-30 rounded-2xl -z-10 scale-[0.92] transform translate-y-2 transition-all duration-500 border border-[#5f6368]/20"></div>
              )}

              {/* Navigation Arrows (Desktop) */}
              <button 
                onClick={handlePrevCard}
                disabled={currentCardIndex === 0}
                className="absolute top-1/2 -left-14 -translate-y-1/2 p-3 rounded-full bg-[#303134] text-[#e8eaed] border border-[#5f6368]/50 shadow-lg disabled:opacity-0 transition-all hover:bg-[#3c4043] hover:scale-110 z-20 hidden md:block"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>

              <button 
                onClick={handleNextCard}
                disabled={currentCardIndex === papersToShow.length - 1}
                className="absolute top-1/2 -right-14 -translate-y-1/2 p-3 rounded-full bg-[#303134] text-[#e8eaed] border border-[#5f6368]/50 shadow-lg disabled:opacity-0 transition-all hover:bg-[#3c4043] hover:scale-110 z-20 hidden md:block"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>

              {/* Active Card */}
              <div className="relative group transform transition-all duration-500 ease-out">
                 <PaperCard 
                    paper={papersToShow[currentCardIndex]} 
                    index={currentCardIndex} 
                    className="shadow-2xl border border-[#5f6368]/50"
                 />
                 
                 {/* Add to Context Button (Floating on card) */}
                 <button 
                    onClick={() => handleAddToContext(papersToShow[currentCardIndex])}
                    className="absolute top-4 right-4 bg-[#202124] text-[#e8eaed] border border-[#5f6368] p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-[#303134] hover:scale-110 hover:border-[#e8eaed] z-30"
                    title="Add to analysis context"
                 >
                   <PlusIcon className="w-4 h-4" />
                 </button>
              </div>
            </div>

            {/* Pagination Dots */}
            <div className="flex items-center gap-2 mt-8">
              {papersToShow.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentCardIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentCardIndex ? 'w-8 bg-[#e8eaed]' : 'w-1.5 bg-[#5f6368] hover:bg-[#9aa0a6]'
                  }`}
                  aria-label={`Go to card ${i + 1}`}
                />
              ))}
            </div>
            
            <p className="text-[#5f6368] text-[10px] uppercase tracking-widest mt-4 md:hidden">
              Swipe to Navigate
            </p>
          </div>
        ) : (
          <div className="bg-[#202124] rounded-2xl border border-[#5f6368]/30 shadow-inner min-h-[500px] flex items-center justify-center overflow-hidden animate-fade-in relative">
             <GraphView 
               rootPapers={contextPapers}
               papers={papersToShow}
               type={activeTab === TabState.CORRELATED ? 'correlated' : 'author'}
               onAddToContext={handleAddToContext}
               onNewSearch={handleNewSearch}
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
      {/* Navbar - Only visible on Landing Page */}
      {isLanding && (
        <header className="bg-[#202124] sticky top-0 z-50 pt-4">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-center">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => {
                setContextPapers([]);
                setState({ isLoading: false, error: null, data: null });
                setQuery('');
            }}>
              <BookOpenIcon className="w-6 h-6 text-[#e8eaed]" />
              <span className="text-xl font-bold text-[#e8eaed] tracking-tight">Nexus</span>
            </div>
          </div>
        </header>
      )}

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
            - If results: Standard flow, search bar at top (pt-6)
        */}
        <div className={`max-w-4xl mx-auto w-full px-4 flex flex-col transition-all duration-500 ${isLanding ? 'flex-grow justify-end pb-12' : 'pt-6'}`}>
          
          {/* Search Bar Area 
              - When !isLanding, we make it sticky at the top to serve as the new 'header'
          */}
          <div className={`relative z-40 w-full max-w-2xl mx-auto ${!isLanding ? 'sticky top-4' : ''}`}>
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

      {/* History Floating Button & Popover - Only shown if history exists and NOT on landing page */}
      {!isLanding && searchHistory.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50">
          {isHistoryOpen && (
            <div className="absolute bottom-full left-0 mb-4 w-72 bg-[#303134] border border-[#5f6368]/50 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">
              <div className="px-4 py-3 border-b border-[#5f6368]/30 flex justify-between items-center bg-[#202124]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9aa0a6]">Recent Searches</span>
                <button onClick={() => setIsHistoryOpen(false)} className="text-[#9aa0a6] hover:text-[#e8eaed]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto no-scrollbar">
                {searchHistory.map((histCtx, idx) => {
                  const label = histCtx.length === 1 ? histCtx[0].title : `Cluster: ${histCtx.length} Papers`;
                  return (
                    <button 
                      key={idx}
                      onClick={() => handleRestoreHistory(histCtx)}
                      className="w-full text-left px-4 py-3 hover:bg-[#3c4043] transition-colors border-b border-[#5f6368]/30 last:border-0 flex items-start gap-3 group"
                    >
                      <div className="mt-1 opacity-50 group-hover:opacity-100 text-[#e8eaed]">
                          {histCtx.length > 1 ? <NetworkIcon className="w-4 h-4" /> : <BookOpenIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#e8eaed] truncate">{label}</div>
                          {histCtx.length > 1 && (
                            <div className="text-[10px] text-[#9aa0a6] truncate mt-0.5">
                              {histCtx.map(p => p.title).slice(0, 2).join(', ')}...
                            </div>
                          )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`p-3.5 rounded-full shadow-lg border border-[#5f6368]/50 transition-all duration-300 ${
              isHistoryOpen ? 'bg-[#e8eaed] text-[#202124] hover:bg-white' : 'bg-[#303134] text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
            title="Search History"
          >
            <HistoryIcon className="w-6 h-6" />
          </button>
        </div>
      )}
      
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
