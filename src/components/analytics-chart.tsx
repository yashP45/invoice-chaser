"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Props = {
  cashflow: { month: string; total: number }[];
  slowest: { name: string; avg_days_late: number }[];
};

export function AnalyticsCharts({ cashflow, slowest }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cash flow (6 months)
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashflow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Slowest paying clients
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={slowest} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={90} />
              <Tooltip />
              <Bar dataKey="avg_days_late" fill="#0f172a" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {slowest.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            No paid invoices yet to compute slowest clients.
          </p>
        )}
      </div>
    </div>
  );
}
