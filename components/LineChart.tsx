import React from 'react';
import ReactApexChart from 'react-apexcharts';

interface LineChartDatum {
  label: string;
  value: number;
}

interface LineChartProps {
  title?: string;
  data: LineChartDatum[];
  height?: number;
  color?: string;
  yLabel?: string;
  xTickEvery?: number; // kept for API compatibility (not used)
}

const LineChart: React.FC<LineChartProps> = ({ title, data, height = 260, color = '#34D399', yLabel }) => {
  const categories = data.map(d => d.label);
  const series = [{ name: title || 'Series', data: data.map(d => d.value) }];
  const options: any = {
    chart: { type: 'line', toolbar: { show: false }, animations: { enabled: true } },
    stroke: { curve: 'smooth', width: 3 },
    colors: [color],
    xaxis: { categories, labels: { rotate: 0 } },
    yaxis: { title: { text: yLabel || undefined } },
    grid: { borderColor: '#E5E7EB' },
    markers: { size: 3 },
    legend: { show: false },
    tooltip: { theme: 'light' },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 w-full h-full">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-gray-700">{title}</h3>
          {typeof yLabel === 'string' && <span className="text-xs text-gray-500">{yLabel}</span>}
        </div>
      )}
      <ReactApexChart options={options} series={series} type="line" height={height} />
    </div>
  );
};

export default LineChart;

