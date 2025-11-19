"use client";

import { useState, useEffect } from 'react';
import { firestoreMonitor } from '@/lib/firestore-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Play, Pause, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function FirestoreMonitorPage() {
  const [stats, setStats] = useState(firestoreMonitor.getStats());
  const [isMonitoring, setIsMonitoring] = useState(firestoreMonitor.isMonitoringEnabled());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setStats(firestoreMonitor.getStats());
      }, 2000); // Update every 2 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      firestoreMonitor.disable();
      setIsMonitoring(false);
    } else {
      firestoreMonitor.enable();
      setIsMonitoring(true);
    }
    setStats(firestoreMonitor.getStats());
  };

  const handleReset = () => {
    firestoreMonitor.reset();
    setStats(firestoreMonitor.getStats());
  };

  const collections = Object.entries(stats.byCollection).sort(
    (a, b) => (b[1].reads + b[1].writes) - (a[1].reads + a[1].writes)
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Firestore Usage Monitor</CardTitle>
              <CardDescription>
                Real-time tracking of Firestore reads, writes, and deletes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isMonitoring ? "destructive" : "default"}
                onClick={handleToggleMonitoring}
                size="sm"
              >
                {isMonitoring ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Monitoring
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Monitoring
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                size="sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Stats
              </Button>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                size="sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Reads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.total.reads.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.rates.readsPerMinute.toFixed(1)} reads/min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Writes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.total.writes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.rates.writesPerMinute.toFixed(1)} writes/min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Reads (5 min)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recent.reads.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {stats.recent.timeWindow}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Writes (5 min)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recent.writes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {stats.recent.timeWindow}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Monitoring for {Math.floor(stats.elapsed / 60)} minutes {stats.elapsed % 60} seconds
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage by Collection</CardTitle>
          <CardDescription>
            Breakdown of reads and writes per collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection</TableHead>
                <TableHead className="text-right">Reads</TableHead>
                <TableHead className="text-right">Writes</TableHead>
                <TableHead className="text-right">Deletes</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No operations recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                collections.map(([collection, counts]) => {
                  const total = counts.reads + counts.writes + counts.deletes;
                  return (
                    <TableRow key={collection}>
                      <TableCell className="font-medium">{collection}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {counts.reads.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {counts.writes.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {counts.deletes.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Operations</CardTitle>
          <CardDescription>
            Last 50 Firestore operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.operations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No operations recorded yet
              </p>
            ) : (
              stats.operations.slice().reverse().map((op, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        op.type === 'read'
                          ? 'outline'
                          : op.type === 'write'
                          ? 'default'
                          : 'destructive'
                      }
                      className={
                        op.type === 'read'
                          ? 'bg-blue-50 text-blue-700'
                          : op.type === 'write'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }
                    >
                      {op.type.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{op.collection}</span>
                    <span className="text-muted-foreground">.{op.operation}</span>
                    {op.documentCount && op.documentCount > 1 && (
                      <span className="text-muted-foreground">
                        ({op.documentCount} docs)
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(op.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Check in Firebase Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">1. Firebase Console में जाएं:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>
                <a
                  href="https://console.firebase.google.com/project/bizsuite-dataflow/usage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Firebase Console Usage Dashboard
                </a>
              </li>
              <li>Project: <code className="bg-muted px-1 rounded">bizsuite-dataflow</code> select करें</li>
              <li>Left sidebar में <strong>"Usage"</strong> या <strong>"Usage and billing"</strong> click करें</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">2. Firestore Usage देखें:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li><strong>"Cloud Firestore"</strong> section में जाएं</li>
              <li>आपको दिखेगा:
                <ul className="list-circle list-inside ml-6 mt-1">
                  <li>Document reads (per day/hour)</li>
                  <li>Document writes (per day/hour)</li>
                  <li>Document deletes</li>
                  <li>Storage used</li>
                </ul>
              </li>
              <li>Time range select करें (Last 24 hours, Last 7 days, etc.)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">3. Real-time Monitoring:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Console में data update होने में कुछ minutes लग सकते हैं</li>
              <li>इस page पर real-time stats देख सकते हैं (ऊपर)</li>
              <li>Browser console में भी logs दिखेंगे (development mode में)</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              💡 Tip: इस page को bookmark करें और regularly check करें कि reads/writes कितने हो रहे हैं।
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

