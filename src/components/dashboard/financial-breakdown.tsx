import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChevronsRight, PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const PIE_COLORS = ['#22c55e', '#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899'];

export type ChartDataPoint = { name: string; value: number };

interface FinancialBreakdownProps {
    level1Data: ChartDataPoint[];
    level2Data: ChartDataPoint[];
    level3Data: ChartDataPoint[];
    level4Data: ChartDataPoint[];
    level1: string | null;
    level2: string | null;
    level3: string | null;
    setLevel1: (val: string | null) => void;
    setLevel2: (val: string | null) => void;
    setLevel3: (val: string | null) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 border rounded-lg bg-background/80 backdrop-blur-sm shadow-md text-xs">
                <p className="label font-bold">{label}</p>
                {payload.map((p: any) => (
                     <p key={p.dataKey} style={{ color: p.color }}>{`${p.name}: ${formatCurrency(p.value)}`}</p>
                ))}
            </div>
        );
    }
    return null;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.02) return null; // Hide label for very small slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold pointer-events-none">
             {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export const FinancialBreakdown = ({
    level1Data, level2Data, level3Data, level4Data,
    level1, level2, level3,
    setLevel1, setLevel2, setLevel3
}: FinancialBreakdownProps) => {

    const breadcrumbs = React.useMemo(() => {
        const crumbs = ['Overview'];
        if (level1) crumbs.push(level1);
        if (level2) crumbs.push(level2);
        if (level3) crumbs.push(level3);
        return crumbs;
    }, [level1, level2, level3]);

    const handleBreadcrumbClick = (index: number) => {
        if (index < 3) setLevel3(null);
        if (index < 2) setLevel2(null);
        if (index < 1) setLevel1(null);
    };

    const totalL1 = level1Data.reduce((sum, i) => sum + i.value, 0);
    const totalL2 = level2Data.reduce((sum, i) => sum + i.value, 0);
    const totalL3 = level3Data.reduce((sum, i) => sum + i.value, 0);
    const totalL4 = level4Data.reduce((sum, i) => sum + i.value, 0);

    const renderNode = (item: {name: string, value: number}, level: number, total: number, onClick: () => void, isSelected: boolean) => (
        <div 
            key={item.name} 
            onClick={onClick} 
            className={cn(
                "flex justify-between items-center text-sm p-2 rounded-md cursor-pointer hover:bg-accent/50", 
                isSelected && "bg-accent font-semibold",
                `pl-${level * 4}`
            )}
        >
            <span>{toTitleCase(item.name)}</span>
            <div className="text-right">
                <p>{formatCurrency(item.value)}</p>
                <p className="text-xs text-muted-foreground">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</p>
            </div>
        </div>
    );

    return (
        <Card className="shadow-none border sm:shadow-sm">
            <CardHeader className="p-3 sm:p-6 pb-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                    <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary"/>
                    Financial Breakdown
                </CardTitle>
                 <div className="text-[11px] sm:text-sm text-muted-foreground flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb}>
                            <Button
                                variant="link"
                                onClick={() => handleBreadcrumbClick(index)}
                                className="p-0 h-auto text-[11px] sm:text-sm text-muted-foreground hover:text-primary disabled:text-foreground disabled:no-underline"
                                disabled={index === breadcrumbs.length - 1}
                            >
                                {toTitleCase(crumb)}
                            </Button>
                            {index < breadcrumbs.length - 1 && <ChevronsRight size={12} className="opacity-50" />}
                        </React.Fragment>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-center">
                <div className="h-[280px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Pie data={level1Data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="35%" stroke="hsl(var(--card))" strokeWidth={2} onClick={(data) => { setLevel1(data.name); setLevel2(null); setLevel3(null); }}>
                                {level1Data.map((entry, index) => ( <Cell key={`cell-0-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                            </Pie>
                            {level1 && <Pie data={level2Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="40%" outerRadius="55%" label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={2} onClick={(data) => { setLevel2(data.name); setLevel3(null); }}>
                                {level2Data.map((entry, index) => ( <Cell key={`cell-1-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                            </Pie>}
                            {level2 && <Pie data={level3Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="75%" label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={2} onClick={(data) => setLevel3(data.name)}>
                                {level3Data.map((entry, index) => ( <Cell key={`cell-2-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                            </Pie>}
                            {level3 && <Pie data={level4Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="80%" outerRadius="95%" label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={2}>
                                {level4Data.map((entry, index) => ( <Cell key={`cell-3-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                            </Pie>}
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div>
                    <ScrollArea className="h-[240px] sm:h-[400px]">
                        <div className="space-y-0.5 sm:space-y-1 p-0.5 sm:p-1">
                            {level1Data.map(l1Item => (
                                <div key={l1Item.name}>
                                    {renderNode(l1Item, 0, totalL1, () => setLevel1(l1Item.name), level1 === l1Item.name)}
                                    {level1 === l1Item.name && level2Data.length > 0 && (
                                        <div className="ml-4 border-l border-primary/20">
                                            {level2Data.map(l2Item => (
                                                <div key={l2Item.name}>
                                                    {renderNode(l2Item, 1, totalL2, () => setLevel2(l2Item.name), level2 === l2Item.name)}
                                                    {level2 === l2Item.name && level3Data.length > 0 && (
                                                        <div className="ml-4 border-l border-green-500/20">
                                                            {level3Data.map(l3Item => (
                                                                <div key={l3Item.name}>
                                                                    {renderNode(l3Item, 2, totalL3, () => setLevel3(l3Item.name), level3 === l3Item.name)}
                                                                    {level3 === l3Item.name && level4Data.length > 0 && (
                                                                        <div className="ml-4 border-l border-red-500/20">
                                                                            {level4Data.map(l4Item => renderNode(l4Item, 3, totalL4, () => {}, false))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
};
