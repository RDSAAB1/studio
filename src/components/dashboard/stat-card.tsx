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
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent className="px-3 pb-3">
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <>
                    <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
                    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                </>
            )}
        </CardContent>
    </Card>
);





interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    colorClass?: string;
    isLoading?: boolean;
    description?: string;
}


