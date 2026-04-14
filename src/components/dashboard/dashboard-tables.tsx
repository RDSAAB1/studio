import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SyncCountRow {
    collection: string;
    indexeddb: number;
    firestore: number;
}

interface SyncCountsTableProps {
    syncCounts: SyncCountRow[];
    appCountsMap: Record<string, number>;
    hideTitle?: boolean;
}

export const SyncCountsTable = ({ syncCounts, appCountsMap, hideTitle }: SyncCountsTableProps) => (
    <Card className={hideTitle ? "border-none shadow-none" : ""}>
        {!hideTitle && (
            <CardHeader>
                <CardTitle>Sync Counts</CardTitle>
            </CardHeader>
        )}
        <CardContent className={hideTitle ? "p-0" : ""}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Collection</TableHead>
                        <TableHead>In App</TableHead>
                        <TableHead>IndexedDB</TableHead>
                        <TableHead>Firestore</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {syncCounts.map((row) => {
                        const inApp = appCountsMap[row.collection] ?? 0;
                        return (
                            <TableRow key={row.collection}>
                                <TableCell className="font-medium">{row.collection}</TableCell>
                                <TableCell>{inApp}</TableCell>
                                <TableCell>{row.indexeddb}</TableCell>
                                <TableCell>{row.firestore}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

interface SoftwareCountRow {
    name: string;
    count: number;
}

interface SoftwareCountsTableProps {
    softwareCounts: SoftwareCountRow[];
    hideTitle?: boolean;
}

export const SoftwareCountsTable = ({ softwareCounts, hideTitle }: SoftwareCountsTableProps) => (
    <Card className={hideTitle ? "border-none shadow-none" : ""}>
        {!hideTitle && (
            <CardHeader>
                <CardTitle>Software Table Counts</CardTitle>
                <CardDescription>App ke andar loaded entries ka summary</CardDescription>
            </CardHeader>
        )}
        <CardContent className={hideTitle ? "p-0" : ""}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Total Entries (In App)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {softwareCounts.map((row) => (
                        <TableRow key={row.name}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.count}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);
