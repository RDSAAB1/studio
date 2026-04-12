'use client';

import { useEffect } from 'react';

export default function DebugPage() {
    useEffect(() => {
        async function run() {
            const electron = (window as any).electron;
            if (!electron) return;
            const log = await electron.sqliteQuery('_sync_log', { limit: 5 });
            console.log('[DEBUG] _sync_log:', log);
        }
        run();
    }, []);
    return <div>Check Console</div>;
}
