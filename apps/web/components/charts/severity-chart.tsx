"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Data = {
  name: string;
  value: number;
};

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981"];

export function SeverityChart({ data }: { data: Data[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
        No severity data yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={3}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
