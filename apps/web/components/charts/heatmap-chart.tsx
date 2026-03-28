"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function HeatmapChart({
  data,
}: {
  data: { file: string; count: number }[];
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="file" type="category" width={240} />
          <Tooltip />
          <Bar dataKey="count" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
