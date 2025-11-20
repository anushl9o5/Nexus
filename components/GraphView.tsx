
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Paper } from '../types';
import PaperCard from './PaperCard';
import { UsersIcon, BookOpenIcon, PlusIcon, InfoIcon } from './Icons';

interface GraphViewProps {
  rootPapers: Paper[];
  papers: Paper[];
  type: 'correlated' | 'author';
  onAddToContext: (paper: Paper) => void;
  onNewSearch: (paper: Paper) => void;
}

const GraphView: React.FC<GraphViewProps> = ({ rootPapers, papers, type, onAddToContext, onNewSearch }) => {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  // Track which node is 'active' (clicked) to show the menu options
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [time, setTime] = useState(0);

  // Animation loop for "breathing" effect (organic drift)
  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setTime((t) => t + 0.005); 
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: 600, 
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate score stats for relative scaling
  const scoreStats = useMemo(() => {
    const scores = papers.map(p => p.relevanceScore ?? 0);
    if (scores.length === 0) return { min: 0, max: 100, range: 100 };
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max === min ? 1 : max - min; 
    return { min, max, range };
  }, [papers]);

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.45;
  
  const rootColor = '#ffffff'; 
  const nodeColor = '#e8eaed'; 

  // 1. Calculate Root Cluster Positions
  const rootNodes = useMemo(() => {
    const count = rootPapers.length;
    return rootPapers.map((paper, i) => {
       let ox = 0;
       let oy = 0;
       
       if (count === 2) {
         ox = (i === 0 ? -25 : 25);
       } else if (count > 2) {
         const angle = (i / count) * Math.PI * 2;
         ox = Math.cos(angle) * 30;
         oy = Math.sin(angle) * 30;
       }

       return { paper, ox, oy };
    });
  }, [rootPapers]);

  // 2. Calculate Result Nodes Layout
  const nodes = useMemo(() => {
    const generated: { angle: number; distance: number; paper: Paper }[] = [];
    papers.forEach((paper) => {
      let angle = 0;
      let distance = 0;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 150) {
        angle = Math.random() * Math.PI * 2;
        distance = 0.55 + Math.random() * 0.35; 
        
        valid = true;
        for (const other of generated) {
          const angleDiff = Math.abs(other.angle - angle);
          if (angleDiff < 0.5 && Math.abs(other.distance - distance) < 0.2) {
             valid = false;
             break;
          }
        }
        attempts++;
      }
      generated.push({ angle, distance, paper });
    });
    return generated;
  }, [papers]);

  // 3. Animated Nodes with Data
  const animatedNodes = nodes.map((node, i) => {
    const { angle, distance, paper } = node;
    
    // Drift logic
    const driftX = Math.sin(time * 0.5 + i * 2) * 8; 
    const driftY = Math.cos(time * 0.3 + i * 1.5) * 8;
    
    const r = distance * maxRadius;
    const x = cx + r * Math.cos(angle) + driftX;
    const y = cy + r * Math.sin(angle) + driftY;
    
    const score = paper.relevanceScore || 0;
    const relativeStrength = (score - scoreStats.min) / scoreStats.range;
    const radius = 25 + (relativeStrength * 30);

    return { ...node, x, y, score, relativeStrength, radius, id: i };
  });

  const clearSelection = () => {
    setActiveNodeIndex(null);
    setSelectedPaper(null);
  };

  return (
    <div 
      className="relative w-full bg-[#202124]" 
      style={{ height: dimensions.height }} 
      ref={containerRef}
      onClick={clearSelection} // Clicking background clears selection
    >
      
      {/* Background Artifacts - Subtle Monochrome Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl opacity-[0.02]"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#9aa0a6] rounded-full blur-3xl opacity-[0.03]"></div>
      </div>

      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        className="absolute top-0 left-0 z-10 pointer-events-auto overflow-visible"
      >
        <defs>
          <radialGradient id="nodeGradient" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#bdc1c6" />
          </radialGradient>
          
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
             <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
             </feMerge>
          </filter>
        </defs>

        {/* LAYER 1: Connections (Tentacles) to Center */}
        {animatedNodes.map((node, i) => {
          const startX = cx;
          const startY = cy;

          const dx = node.x - startX;
          const dy = node.y - startY;
          const midX = (startX + node.x) / 2;
          const midY = (startY + node.y) / 2;
          
          const curveDir = i % 2 === 0 ? 1 : -1;
          const curveStrength = 40 + Math.sin(time + i) * 15; 
          
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = (-dy / dist) * curveStrength * curveDir;
          const perpY = (dx / dist) * curveStrength * curveDir;
          
          const cpX = midX + perpX;
          const cpY = midY + perpY;

          const opacity = 0.1 + (node.relativeStrength * 0.4);
          const width = 2 + (node.relativeStrength * 6);

          return (
            <g key={`edge-${i}`}>
               <path 
                 d={`M ${startX} ${startY} Q ${cpX} ${cpY} ${node.x} ${node.y}`} 
                 stroke="#202124" 
                 strokeWidth={width + 4} 
                 strokeOpacity={0.8}
                 fill="none" 
               />
               <path
                d={`M ${startX} ${startY} Q ${cpX} ${cpY} ${node.x} ${node.y}`} 
                stroke={rootColor}
                strokeWidth={width}
                strokeOpacity={opacity}
                fill="none"
                strokeLinecap="round"
                className="transition-all duration-75 ease-linear"
              />
            </g>
          );
        })}

        {/* LAYER 2: Root Cluster */}
        <g transform={`translate(${cx}, ${cy})`} className="isolate cursor-default">
           {rootNodes.map((root, idx) => (
             <g key={`root-${idx}`} transform={`translate(${root.ox}, ${root.oy})`}>
               <title>{root.paper.title}</title>
               <circle r="65" fill={rootColor} fillOpacity="0.1" className="animate-pulse" />
               <circle r="55" fill="#303134" stroke={rootColor} strokeWidth="3" className="shadow-lg" />
               <foreignObject x="-25" y="-25" width="50" height="50">
                  <div className="flex items-center justify-center h-full text-[#e8eaed]">
                     {type === 'correlated' ? <BookOpenIcon className="w-8 h-8" /> : <UsersIcon className="w-8 h-8" />}
                  </div>
               </foreignObject>
             </g>
           ))}
        </g>

        {/* LAYER 3: Result Nodes */}
        {animatedNodes.map((node, i) => {
          const isHovered = hoveredIndex === i;
          const isActive = activeNodeIndex === i;
          const isSelected = selectedPaper === node.paper;
          
          const displayRadius = (isHovered || isActive) ? node.radius + 5 : node.radius;
          const showMenu = isHovered || isActive;

          return (
            <g 
              key={`node-${i}`} 
              transform={`translate(${node.x}, ${node.y})`} 
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(e) => {
                e.stopPropagation();
                // Single click sets this node as active to show the menu
                setActiveNodeIndex(i);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onNewSearch(node.paper);
              }}
              className="cursor-pointer transition-transform duration-300 ease-out"
              style={{ zIndex: 100 + i }}
            >
              {node.relativeStrength > 0.8 && (
                 <circle 
                    r={displayRadius + 8} 
                    stroke={rootColor} 
                    strokeWidth="2" 
                    strokeDasharray="4,4"
                    fill="none"
                    className="opacity-30 animate-spin-slow"
                 />
              )}

              <circle 
                r={displayRadius} 
                fill="url(#nodeGradient)"
                stroke={isActive ? rootColor : (isHovered ? rootColor : '#303134')} 
                strokeWidth={isActive ? 4 : (isHovered ? 3 : 1)}
                filter={(isHovered || isActive) ? "url(#glow)" : ""}
                className="transition-all duration-300"
              />
              
              {/* Inner Dot */}
              <circle r={displayRadius * 0.25} fill="#202124" fillOpacity={0.6} />

              {/* Menu Popup (Visible on Hover or Single Click) */}
              <foreignObject 
                x={-90} 
                y={displayRadius + 10} 
                width="180" 
                height="140" 
                className={`pointer-events-none transition-all duration-300 ${showMenu ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
              >
                <div className="flex flex-col items-center space-y-2 pointer-events-auto">
                  {/* Title */}
                  <div className="bg-[#303134] text-[#e8eaed] text-xs font-medium text-center px-3 py-2 rounded-xl shadow-xl leading-tight backdrop-blur-sm border border-[#5f6368]/50 w-full truncate">
                    {node.paper.title}
                  </div>
                  
                  {/* Action Row */}
                  <div className="flex items-center gap-2 bg-[#303134] p-1.5 rounded-full border border-[#5f6368] shadow-lg">
                    {/* Match Score */}
                    <div className="text-[10px] font-bold text-[#202124] bg-[#e8eaed] px-2 py-1 rounded-full">
                      {node.score}%
                    </div>
                    
                    <div className="w-px h-4 bg-[#5f6368]"></div>

                    {/* Info Button - Shows Detail Card */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPaper(node.paper);
                      }}
                      className="text-[#e8eaed] hover:text-white hover:bg-[#5f6368] p-1 rounded-full transition-colors"
                      title="View Details"
                    >
                      <InfoIcon className="w-4 h-4" />
                    </button>

                    {/* Plus Button - Adds to Context */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToContext(node.paper);
                      }}
                      className="text-[#e8eaed] hover:text-white hover:bg-[#5f6368] p-1 rounded-full transition-colors"
                      title="Add to analysis context"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Overlay Details Card */}
      <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none flex justify-center z-30">
        {selectedPaper ? (
          <div className="pointer-events-auto w-full max-w-xl animate-fade-in-up">
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedPaper(null); }}
                className="absolute -top-3 -right-3 bg-[#303134] text-[#e8eaed] rounded-full p-1.5 hover:bg-[#3c4043] shadow-lg z-50 transition-transform hover:scale-110 border border-[#5f6368]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <PaperCard paper={selectedPaper} index={0} />
            </div>
          </div>
        ) : (
          <div className="bg-[#303134]/90 backdrop-blur-md text-[#9aa0a6] text-xs font-semibold px-5 py-2.5 rounded-full border border-[#5f6368]/60 shadow-lg pointer-events-auto transform hover:scale-105 transition-transform">
            Double Click Node to Reset Search
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
};

export default GraphView;
