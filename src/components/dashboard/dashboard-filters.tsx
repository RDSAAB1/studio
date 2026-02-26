import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import type { DateRange } from 'react-day-picker';

type DashboardFiltersProps = {
    date: DateRange | undefined;
    setDate: (range: DateRange | undefined) => void;
};

export const DashboardFilters = ({ date, setDate }: DashboardFiltersProps) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">Dashboard</CardTitle>
            <CardDescription>Filter and view your business overview.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <DateRangePicker date={date} onDateChange={setDate} />
            <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}>This Week</Button>
                <Button variant="outline" size="sm" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                <Button variant="outline" size="sm" onClick={() => setDate({ from: subDays(new Date(), 30), to: new Date() })}>Last 30 Days</Button>
                <Button variant="outline" size="sm" onClick={() => setDate({ from: startOfYear(new Date()), to: endOfYear(new Date()) })}>This Year</Button>
            </div>
        </CardContent>
    </Card>
);
