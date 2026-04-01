/**
 * ✅ Shared utility for chunked IndexedDB operations
 * Prevents main thread blocking by processing data in smaller chunks
 */

/**
 * Helper to yield control to main thread
 */
export function yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') {
            resolve();
            return;
        }
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => resolve(), { timeout: 1 });
        } else {
            setTimeout(() => resolve(), 0);
        }
    });
}

/**
 * ✅ OPTIMIZED: Chunked bulkPut to prevent main thread blocking
 * Processes data in chunks and yields to main thread between chunks
 */
export async function chunkedBulkPut<T extends { id: string }>(
    table: any,
    items: T[],
    chunkSize: number = 100
): Promise<void> {
    if (!table || items.length === 0) return;
    
    // For small datasets, use regular bulkPut
    if (items.length <= chunkSize) {
        await table.bulkPut(items);
        return;
    }
    
    // ✅ Process in chunks with yields to prevent blocking
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        try {
            await table.bulkPut(chunk);
        } catch (error) {
            console.error(`[chunkedBulkPut] Error in chunk ${i}-${i + chunkSize}:`, error);
            // Re-throw so the caller (safeBulkReplace) can handle the fallback
            throw error;
        }
        
        // Yield to main thread every chunk (except last)
        if (i + chunkSize < items.length) {
            await yieldToMainThread();
        }
    }
}

/**
 * ✅ OPTIMIZED: Chunked bulkDelete to prevent main thread blocking
 */
export async function chunkedBulkDelete(
    table: any,
    ids: (string | number)[],
    chunkSize: number = 200
): Promise<void> {
    if (!table || ids.length === 0) return;
    
    // For small datasets, use regular bulkDelete
    if (ids.length <= chunkSize) {
        await table.bulkDelete(ids);
        return;
    }
    
    // ✅ Process in chunks with yields to prevent blocking
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await table.bulkDelete(chunk);
        
        // Yield to main thread every chunk (except last)
        if (i + chunkSize < ids.length) {
            await yieldToMainThread();
        }
    }
}

/**
 * ✅ OPTIMIZED: Chunked toArray to prevent main thread blocking
 * ✅ FIXED: Uses proper cursor pagination to prevent missing items
 * Reads data in chunks using cursor-based pagination (Dexie compatible)
 */
export async function chunkedToArray<T>(
    table: any,
    chunkSize: number = 500,
    orderByField?: string,
    reverse: boolean = false
): Promise<T[]> {
    if (!table) return [];
    
    try {
        // For small datasets, use regular toArray
        const count = await table.count();
        if (count <= chunkSize) {
            if (orderByField) {
                const query = reverse ? table.orderBy(orderByField).reverse() : table.orderBy(orderByField);
                return await query.toArray() as T[];
            }
            return await table.toArray() as T[];
        }
        
        // ✅ FIXED: Use offset-based pagination which handles duplicate values correctly
        // Dexie's offset is efficient enough for client-side limits (< 100k records)
        // and guarantees we don't skip items with same values (unlike above/below)
        
        const allItems: T[] = [];
        let processed = 0;
        
        // Get base query
        let baseQuery: any;
        if (orderByField) {
            baseQuery = reverse 
                ? table.orderBy(orderByField).reverse()
                : table.orderBy(orderByField);
        } else {
            baseQuery = table;
        }
        
        while (processed < count) {
            const chunk = await baseQuery.offset(processed).limit(chunkSize).toArray() as T[];
            
            if (chunk.length === 0) break;
            
            allItems.push(...chunk);
            processed += chunk.length;
            
            // Yield to main thread
            await yieldToMainThread();
        }
        
        return allItems;
    } catch (error) {
        // Fallback to regular toArray if chunked reading fails
        if (orderByField) {
            const query = reverse ? table.orderBy(orderByField).reverse() : table.orderBy(orderByField);
            return await query.toArray() as T[];
        }
        return await table.toArray() as T[];
    }
}

