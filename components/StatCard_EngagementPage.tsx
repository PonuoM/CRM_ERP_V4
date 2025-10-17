import React, { useState } from 'react';
import { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<LucideProps>;
  titleText?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, icon: Icon, titleText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Check if the percentage change is negative
  const isNegative = subtext.includes('-');
  
  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
      <p className="text-sm text-gray-500">{title}</p>
      <div className="flex justify-between items-end mt-1">
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <div
        className={`flex items-center text-xs mt-2 relative ${isNegative ? 'text-red-600' : 'text-green-600'}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
         {/* In a real app, this could be a trending icon */}
         <div className={`w-2 h-2 rounded-full mr-1.5 ${isNegative ? 'bg-red-500' : 'bg-green-500'}`}></div>
         <span>{subtext}</span>
         
         {showTooltip && titleText && (
           <div className="absolute bottom-full left-0 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap z-10">
             {titleText}
             <div className="absolute top-full left-4 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
           </div>
         )}
      </div>
    </div>
  );
};

export default StatCard;
