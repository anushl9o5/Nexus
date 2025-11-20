import React from 'react';
import { Paper } from '../types';
import { LinkIcon, UsersIcon, BookOpenIcon } from './Icons';

interface PaperCardProps {
  paper: Paper;
  index: number;
  className?: string;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, index, className }) => {
  const googleScholarLink = `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title + " " + paper.authors[0])}`;

  return (
    <div 
      className={`group relative bg-white dark:bg-[#303134] rounded-2xl p-6 shadow-sm border border-[#dadce0] dark:border-[#5f6368]/40 hover:shadow-lg hover:border-[#5f6368] dark:hover:border-[#e8eaed]/50 transition-all duration-300 ease-out animate-fade-in-up ${className || ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          {/* Badge for Context/Reason */}
          <div className="inline-block px-3 py-1.5 rounded-xl text-xs font-medium bg-[#f1f3f4] dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#5f6368]/50 mb-3 whitespace-normal break-words max-w-full leading-relaxed">
            {paper.reason}
          </div>

          <h3 className="text-lg font-bold text-[#202124] dark:text-[#e8eaed] leading-tight mb-2 group-hover:text-black dark:group-hover:text-white transition-colors">
            {paper.title}
          </h3>

          <div className="flex flex-wrap gap-y-1 items-center text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-4">
            <span className="flex items-center mr-4">
              <UsersIcon className="w-4 h-4 mr-1.5 opacity-70" />
              {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
            </span>
            <span className="flex items-center mr-4">
              <BookOpenIcon className="w-4 h-4 mr-1.5 opacity-70" />
              {paper.year}
            </span>
            {paper.labOrInstitution && (
              <span className="text-[#5f6368]/70 dark:text-[#9aa0a6]/70 italic text-xs">
                {paper.labOrInstitution}
              </span>
            )}
          </div>

          <p className="text-[#3c4043] dark:text-[#bdc1c6] text-sm leading-relaxed mb-4">
            {paper.summary}
          </p>
        </div>

        <div className="pt-4 border-t border-[#dadce0] dark:border-[#5f6368]/30 flex justify-end">
          <a 
            href={googleScholarLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-semibold text-[#202124] dark:text-[#e8eaed] hover:text-black dark:hover:text-white hover:underline transition-all"
          >
            View on Scholar
            <LinkIcon className="w-4 h-4 ml-1.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaperCard;