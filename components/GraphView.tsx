import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Paper } from '../types';
import PaperCard from './PaperCard';
import { UsersIcon, BookOpenIcon } from './Icons';

interface GraphViewProps {
  rootTitle: string;
  papers: Paper[];
  type: 'correlated' | 'author';
}

const GraphView: React.FC<GraphViewProps> = ({ rootTitle, papers, type }) => {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [time, setTime] = useState(0);

  // Animation loop for "breathing" effect (organic drift)
  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setTime((t) => t + 0.005); // Slower, more majestic movement
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

  // Calculate score stats for relative scaling (Normalization)
  const scoreStats = useMemo(() => {
    const scores = papers.map(p => p.relevanceScore ?? 0);
    if (scores.length === 0) return { min: 0, max: 100, range: 100 };
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    // Prevent divide by zero if all scores are identical
    const range = max === min ? 1 : max - min; 
    return { min, max, range };
  }, [papers]);

  // 1. Calculate Layout (Static Base Positions)
  const layout = useMemo(() => {
    const generated: { angle: number; distance: number; paper: Paper }[] = [];
    
    papers.forEach((paper) => {
      let angle = 0;
      let distance = 0;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 150) {
        angle = Math.random() * Math.PI * 2;
        // Pushed out further to accommodate larger Root Node
        // 0.5 to 0.9 of max radius
        distance = 0.50 + Math.random() * 0.40; 
        
        valid = true;
        for (const other of generated) {
          const angleDiff = Math.abs(other.angle - angle);
          // Stricter collision check
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

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.45;
  
  const rootColor = type === 'correlated' ? '#4f46e5' : '#db2777'; // Indigo vs Pink
  const nodeColor = type === 'correlated' ? '#818cf8' : '#f472b6';

  // 2. Calculate Animated Positions & Dynamic Sizes
  const nodes = layout.map((node, i) => {
    const { angle, distance, paper } = node;
    
    // Drift logic
    const driftX = Math.sin(time * 0.5 + i * 2) * 8; 
    const driftY = Math.cos(time * 0.3 + i * 1.5) * 8;
    
    const r = distance * maxRadius;
    const x = cx + r * Math.cos(angle) + driftX;
    const y = cy + r * Math.sin(angle) + driftY;
    
    const score = paper.relevanceScore || 0;
    
    // Aggressive Normalization
    // Map the score within the specific range of this list to a 0-1 scale
    const relativeStrength = (score - scoreStats.min) / scoreStats.range;
    
    // Dynamic Radius: 
    // Root is ~70px.
    // Papers range from 25px (weakest in list) to 55px (strongest in list).
    const radius = 25 + (relativeStrength * 30);

    return {
      ...node,
      x,
      y,
      score,
      relativeStrength,
      radius,
      id: i
    };
  });

  return (
    <div className="relative w-full bg-slate-50/50" style={{ height: dimensions.height }} ref={containerRef}>
      
      {/* Background Artifacts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl opacity-50"></div>
      </div>

      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        className="absolute top-0 left-0 z-10 pointer-events-auto overflow-visible"
      >
        <defs>
          <radialGradient id="nodeGradient" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* LAYER 1: Connections (Tentacles) */}
        {nodes.map((node, i) => {
          const dx = node.x - cx;
          const dy = node.y - cy;
          const midX = (cx + node.x) / 2;
          const midY = (cy + node.y) / 2;
          
          const curveDir = i % 2 === 0 ? 1 : -1;
          const curveStrength = 40 + Math.sin(time + i) * 15; 
          
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = (-dy / dist) * curveStrength * curveDir;
          const perpY = (dx / dist) * curveStrength * curveDir;
          
          const cpX = midX + perpX;
          const cpY = midY + perpY;

          // Connection visual weight based on relative strength
          const opacity = 0.2 + (node.relativeStrength * 0.5); // 0.2 - 0.7
          const width = 2 + (node.relativeStrength * 6); // 2px - 8px

          return (
            <g key={`edge-${i}`}>
               {/* Background highlight line for depth */}
               <path 
                 d={`M ${cx} ${cy} Q ${cpX} ${cpY} ${node.x} ${node.y}`} 
                 stroke="white" 
                 strokeWidth={width + 2} 
                 strokeOpacity={0.5}
                 fill="none" 
               />
               <path
                d={`M ${cx} ${cy} Q ${cpX} ${cpY} ${node.x} ${node.y}`} 
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

        {/* LAYER 2: Root Node (Largest) */}
        <g transform={`translate(${cx}, ${cy})`} className="isolate cursor-default">
          <circle r="75" fill={rootColor} fillOpacity="0.08" className="animate-pulse" />
          <circle r="60" fill={rootColor} fillOpacity="0.15" />
          <circle r="45" fill="white" stroke={rootColor} strokeWidth="4" className="shadow-2xl drop-shadow-lg" />
          <foreignObject x="-30" y="-30" width="60" height="60">
             <div className="flex items-center justify-center h-full text-indigo-600">
                {type === 'correlated' ? <BookOpenIcon className="w-10 h-10" /> : <UsersIcon className="w-10 h-10" />}
             </div>
          </foreignObject>
        </g>

        {/* LAYER 3: Paper Nodes (Variable Size) */}
        {nodes.map((node, i) => {
          const isHovered = hoveredIndex === i;
          const isSelected = selectedPaper === node.paper;
          
          // Hover effect adds slight enlargement
          const displayRadius = isHovered ? node.radius + 5 : node.radius;

          return (
            <g 
              key={`node-${i}`} 
              transform={`translate(${node.x}, ${node.y})`} 
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setSelectedPaper(node.paper)}
              className="cursor-pointer transition-transform duration-300 ease-out"
              style={{ zIndex: 100 + i }}
            >
              {/* Pulsing ring for top matches (relativeStrength > 0.8) */}
              {node.relativeStrength > 0.8 && (
                 <circle 
                    r={displayRadius + 8} 
                    stroke={nodeColor} 
                    strokeWidth="2" 
                    strokeDasharray="4,4"
                    fill="none"
                    className="opacity-30 animate-spin-slow"
                 />
              )}

              {/* Main Circle */}
              <circle 
                r={displayRadius} 
                fill="url(#nodeGradient)"
                stroke={isSelected ? rootColor : nodeColor} 
                strokeWidth={isSelected ? 4 : (node.relativeStrength * 3 + 1)}
                filter={isHovered ? "url(#glow)" : ""}
                className="transition-all duration-300"
              />
              
              {/* Relevance Dot */}
              <circle r={displayRadius * 0.25} fill={nodeColor} fillOpacity={0.4 + node.relativeStrength * 0.6} />

              {/* Hover Label */}
              <foreignObject 
                x={-90} 
                y={displayRadius + 12} 
                width="180" 
                height="100" 
                className={`pointer-events-none transition-all duration-300 ${isHovered || isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
              >
                <div className="flex flex-col items-center">
                  <div className="bg-slate-900/95 text-white text-xs font-medium text-center px-3 py-2.5 rounded-xl shadow-xl leading-tight mb-1 backdrop-blur-sm border border-white/10 relative z-50">
                    {node.paper.title}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 shadow-sm">
                    <span>{node.score}% Match</span>
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
                className="absolute -top-3 -right-3 bg-slate-800 text-white rounded-full p-1.5 hover:bg-slate-700 shadow-lg z-50 transition-transform hover:scale-110 border-2 border-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <PaperCard paper={selectedPaper} index={0} />
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-md text-slate-500 text-xs font-semibold px-5 py-2.5 rounded-full border border-slate-200/60 shadow-lg pointer-events-auto transform hover:scale-105 transition-transform">
            Interactive Graph • Click nodes for details
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