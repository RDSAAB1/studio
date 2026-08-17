import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, CartesianGrid, XAxis, YAxis, Legend, Area, type TooltipProps } from "recharts";
import React from "react";

const PIE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#e11d48",
  "#8b5cf6",
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#6366f1",
];

const customTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs shadow-lg space-y-1.5 min-w-[120px]">
      <div className="font-bold border-b pb-1 mb-1">{String(label || "")}</div>
      {payload.map((item, idx) => (
        <div key={idx} className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}:</span>
          </div>
          <span className="font-mono font-bold">{formatCurrency(Number(item.value || 0))}</span>
        </div>
      ))}
    </div>
  );
};

type NamedValue = { name: string; value: number };

interface DashboardChartsProps {
  assetsLiabilitiesData: NamedValue[];
  paymentMethodData: NamedValue[];
  fundSourcesData: NamedValue[];
  incomeExpenseChartData: { date: string; income: number; expense: number }[];
}

export function DashboardCharts({
  assetsLiabilitiesData,
  paymentMethodData,
  fundSourcesData,
  incomeExpenseChartData,
}: DashboardChartsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <Card className="h-56 sm:h-64 shadow-none border sm:shadow-sm">
          <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-2">
            <CardTitle className="text-sm sm:text-base">Assets vs. Liabilities</CardTitle>
          </CardHeader>
          <CardContent className="h-40 sm:h-48 p-3 sm:p-6 pt-0 grid grid-cols-2 items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={customTooltip} />
                <Pie
                  data={assetsLiabilitiesData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                >
                  {assetsLiabilitiesData.map((entry, index) => (
                    <Cell
                      key={`assets-${index}`}
                      fill={entry.name === "Total Assets" ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {assetsLiabilitiesData.map((entry, index) => (
                <div key={`assets-legend-${index}`} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        entry.name === "Total Assets" ? "#22c55e" : "#ef4444",
                    }}
                  />
                  <div className="text-sm">
                    <p className="text-muted-foreground">{entry.name}</p>
                    <p className="font-semibold">{formatCurrency(entry.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="h-56 sm:h-64 shadow-none border sm:shadow-sm">
          <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-2">
            <CardTitle className="text-sm sm:text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="h-40 sm:h-48 p-3 sm:p-6 pt-0 grid grid-cols-2 items-center gap-2 sm:gap-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={customTooltip} />
                <Pie
                  data={paymentMethodData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell
                      key={`payments-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 overflow-y-auto max-h-full">
              {paymentMethodData.map((entry, index) => (
                <div key={`payments-legend-${index}`} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <div className="text-sm">
                    <p className="text-muted-foreground truncate">{entry.name}</p>
                    <p className="font-semibold">{formatCurrency(entry.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="h-auto md:col-span-2 shadow-none border sm:shadow-sm">
          <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-2">
            <CardTitle className="text-sm sm:text-base">Fund Sources</CardTitle>
          </CardHeader>
          <CardContent className="h-auto p-3 sm:p-6 pt-0 grid grid-cols-2 items-center gap-2 sm:gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={customTooltip} />
                <Pie
                  data={fundSourcesData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {fundSourcesData.map((entry, index) => (
                    <Cell
                      key={`funds-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {fundSourcesData.map((entry, index) => (
                <div key={`funds-legend-${index}`} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <div className="text-sm overflow-hidden">
                    <p
                      className="text-muted-foreground truncate"
                      title={entry.name}
                    >
                      {entry.name}
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(entry.value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="col-span-1 lg:col-span-2 shadow-none border sm:shadow-sm">
        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
          <CardTitle className="text-sm sm:text-base">Income vs. Expense</CardTitle>
        </CardHeader>
        <CardContent className="h-56 sm:h-80 p-3 sm:p-6 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={incomeExpenseChartData}
              margin={{ top: 15, right: 10, left: 15, bottom: 5 }}
            >
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#64748b', fontSize: 10 }}
                dy={8}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 10000000) return `${(value / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`;
                  if (value >= 100000) return `${(value / 100000).toFixed(1).replace(/\.0$/, "")} L`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")} k`;
                  return String(value);
                }}
                dx={-8}
              />
              <Tooltip content={customTooltip} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#incomeGrad)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expenseGrad)"
                fillOpacity={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}
