import React from 'react';
import { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtext: string;
  icon: React.ComponentType<LucideProps>;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, icon: Icon }) => {
  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
      <p className="text-sm text-gray-500">{title}</p>
      <div className="flex justify-between items-end mt-1">
        <div className="text-3xl font-bold text-gray-800 leading-tight">{value}</div>
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <div className="flex items-center text-xs text-green-600 mt-2">
        {/* In a real app, this could be a trending icon */}
        <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
        <span>{subtext}</span>
      </div>
    </div>
  );
};

export default StatCard;
