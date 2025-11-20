import React, { useState, useRef } from 'react';
import { analyzePaper } from './services/geminiService';
import { SearchState, TabState, ResearchResponse } from './types';
import PaperCard from './components/PaperCard';
import GraphView from './components/GraphView';
import { SearchIcon, SparklesIcon, BookOpenIcon, UsersIcon, ArrowRightIcon, NetworkIcon, ListIcon } from './components/Icons';

// Simple animation utility class
const FADE_IN_UP = "animate-[fadeInUp_0.5s_ease-out_forwards]";

type ViewMode = 'LIST' | 'GRAPH';

export default function App() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [activeTab, setActiveTab] = useState<TabState>(TabState.CORRELATED);
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await analyzePaper(query);
      setState({
        isLoading: false,
        error: null,
        data: result,
      });
      // Small delay to let DOM update before scrolling
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      setState({
        isLoading: false,
        error: "Failed to analyze. Please check your connection and try again.",
        data: null,
      });
    }
  };

  const renderContent = () => {
    if (state.isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative w-20 h-20">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-500 animate-pulse font-medium">Analyzing literature graph...</p>
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-xl text-center max-w-md mx-auto mt-10">
          <p className="font-semibold">Oops!</p>
          <p>{state.error}</p>
        </div>
      );
    }

    if (!state.data) {
      return (
        <div className="mt-20 text-center opacity-40 pointer-events-none select-none">
          <SparklesIcon className="w-24 h-24 mx-auto text-slate-300 mb-4" />
          <h2 className="text-2xl font-bold text-slate-400">Start your discovery</h2>
          <p className="text-slate-400 max-w-sm mx-auto mt-2">Enter a paper title or DOI above to map its connections.</p>
        </div>
      );
    }

    const papersToShow = activeTab === TabState.CORRELATED 
      ? state.data.correlatedPapers 
      : state.data.authorContextPapers;

    return (
      <div ref={resultsRef} className="animate-fade-in pb-20">
        {/* Context Header */}
        <div className="mb-8 bg-indigo-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-2">Analyzed Subject</h2>
          <p className="text-xl md:text-2xl font-serif font-medium leading-snug">
            "{state.data.originalPaperContext}"
          </p>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 sticky top-4 z-30">
          {/* Tabs */}
          <div className="bg-slate-50/90 backdrop-blur-md p-1.5 rounded-xl flex shadow-sm border border-slate-200 w-full md:w-auto">
            <button
              onClick={() => setActiveTab(TabState.CORRELATED)}
              className={`flex-1 md:flex-none flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === TabState.CORRELATED
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BookOpenIcon className="w-4 h-4 mr-2" />
              Correlated Work
            </button>
            <button
              onClick={() => setActiveTab(TabState.AUTHOR_CONTEXT)}
              className={`flex-1 md:flex-none flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === TabState.AUTHOR_CONTEXT
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <UsersIcon className="w-4 h-4 mr-2" />
              Author Context
            </button>
          </div>

          {/* View Toggle */}
          <div className="bg-slate-50/90 backdrop-blur-md p-1.5 rounded-xl flex shadow-sm border border-slate-200">
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'LIST'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List View"
            >
              <ListIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('GRAPH')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'GRAPH'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
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
              <PaperCard key={idx} paper={paper} index={idx} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-inner min-h-[500px] flex items-center justify-center overflow-hidden animate-fade-in">
             <GraphView 
               rootTitle={state.data.originalPaperContext}
               papers={papersToShow}
               type={activeTab === TabState.CORRELATED ? 'correlated' : 'author'}
             />
          </div>
        )}
        
        <div className="mt-12 text-center text-slate-400 text-xs">
          AI-generated results. Verify details on Google Scholar.
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <BookOpenIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">ResearchNexus</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4">
        <div className="max-w-4xl mx-auto w-full pt-12 md:pt-20 pb-10">
          
          {/* Hero / Search Area */}
          <div className={`transition-all duration-500 ease-in-out ${state.data ? '' : 'translate-y-[10vh]'}`}>
            <div className="text-center mb-10 space-y-4">
              {!state.data && (
                <>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Find connected <span className="text-indigo-600">science.</span>
                  </h1>
                  <p className="text-lg text-slate-600 max-w-xl mx-auto">
                    Enter a paper title to discover strongly correlated works and deep-dives into the author's related research.
                  </p>
                </>
              )}
            </div>

            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto group z-20">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="h-6 w-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Attention Is All You Need"
                className="block w-full pl-12 pr-16 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-xl shadow-slate-200/50"
              />
              <button
                type="submit"
                disabled={state.isLoading || !query.trim()}
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {state.isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <ArrowRightIcon className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>

          {/* Results Section */}
          <div className="mt-8">
            {renderContent()}
          </div>

        </div>
      </main>
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}