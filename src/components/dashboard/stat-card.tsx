import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    colorClass?: string;
    isLoading?: boolean;
    description?: string;
}

export const StatCard = ({ title, value, icon, colorClass, isLoading, description }: StatCardProps) => (
    <Card className="shadow-none border sm:shadow-sm transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2.5 min-[400px]:p-3 sm:px-6 sm:pt-6 pb-1 sm:pb-2">
            <CardTitle className="text-[10px] min-[400px]:text-xs sm:text-sm font-bold sm:font-medium tracking-tight truncate flex-1">{title}</CardTitle>
            <div className="text-muted-foreground scale-[0.65] min-[400px]:scale-[0.8] sm:scale-100 flex-shrink-0 ml-1">
                {icon}
            </div>
        </CardHeader>
        <CardContent className="p-2.5 min-[400px]:p-3 sm:p-6 pt-0">
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <>
                <div className={`text-[14.5px] min-[400px]:text-[16px] sm:text-2xl font-black sm:font-bold ${colorClass} tracking-tight`}>{value}</div>
                    {description && <p className="text-[8px] min-[400px]:text-[9px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-none sm:leading-normal font-medium truncate sm:whitespace-normal">{description}</p>}
                </>
            )}
        </CardContent>
    </Card>
);
