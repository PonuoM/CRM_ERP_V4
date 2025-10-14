import React from 'react';
import ReactApexChart from 'react-apexcharts';

export interface LinePoint { label: string; value: number }

export interface Series {
  name: string;
  color: string;
  data: LinePoint[];
}

interface MultiLineChartProps {
  title?: string;
  series: Series[];
  height?: number;
  yLabel?: string;
  xLabelEvery?: number; // show every Nth x label (others blank)
}

const MultiLineChart: React.FC<MultiLineChartProps> = ({ title, series, height = 260, yLabel, xLabelEvery }) => {
  const baseCats = series[0]?.data?.map(d => d.label) || [];
  const autoStep = baseCats.length >= 60 ? 4 : baseCats.length >= 40 ? 2 : 1;
  const step = Math.max(1, xLabelEvery || autoStep);
  const categories = baseCats.map((lab, idx) => (idx % step === 0 || idx === baseCats.length - 1 || idx === 0 ? lab : ''));
  const apexSeries = series.map(s => ({ name: s.name, data: s.data.map(d => d.value) }));
  const options: any = {
    chart: { type: 'line', toolbar: { show: false } },
    stroke: { curve: 'smooth', width: 3 },
    colors: series.map(s => s.color),
    xaxis: { categories },
    yaxis: { title: { text: yLabel || undefined } },
    grid: { borderColor: '#E5E7EB' },
    markers: { size: 3 },
    legend: { position: 'top', horizontalAlign: 'left' },
    tooltip: { shared: true, intersect: false, theme: 'light' },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 w-full h-full">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-gray-700">{title}</h3>
          {typeof yLabel === 'string' && <span className="text-xs text-gray-500">{yLabel}</span>}
        </div>
      )}
      <ReactApexChart options={options} series={apexSeries} type="line" height={height} />
    </div>
  );
};

export default MultiLineChart;
