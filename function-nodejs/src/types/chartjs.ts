/**
 * Chart.js type definitions for response format
 */

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'radar' | 'doughnut';

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    title?: {
      display: boolean;
      text?: string;
    };
    tooltip?: any;
  };
  scales?: {
    x?: any;
    y?: {
      beginAtZero?: boolean;
      ticks?: any;
    };
  };
}

export interface ChartJsResponse {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
}
