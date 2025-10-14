import React from 'react';
import ReactApexChart from 'react-apexcharts';

interface PieDatum {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  title?: string;
  data: PieDatum[]; // expected to sum to total; can be empty
  size?: number; // diameter in px
}

const PieChart: React.FC<PieChartProps> = ({ title, data, size = 180 }) => {
  const series = data.map(d => d.value);
  const labels = data.map(d => d.label);
  const colors = data.map(d => d.color);
  const total = series.reduce((a, b) => a + (b || 0), 0);

  const options: any = {
    chart: { type: 'donut', toolbar: { show: false } },
    labels,
    colors,
    legend: { show: true, position: 'right' },
    dataLabels: { enabled: true },
    stroke: { width: 0 },
    tooltip: { theme: 'light' },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: { show: false }, // match CustomerGradeChart layout (no center total)
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      {title && <h3 className="text-md font-semibold text-gray-700 mb-4">{title}</h3>}
      <ReactApexChart options={options} series={series} type="donut" height={size} />
      {total === 0 && <div className="text-center text-xs text-gray-400 mt-2">No data</div>}
    </div>
  );
};

export default PieChart;
