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
        await table.bulkPut(chunk);
        
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
        
        // ✅ FIXED: Use proper cursor-based pagination with last item tracking
        // Dexie doesn't support filter on queries, so we fetch all and process in memory
        // For very large datasets, this is still better than blocking with single toArray
        const allItems: T[] = [];
        let processed = 0;
        let lastItem: T | undefined = undefined;
        const seenIds = new Set<string | number>(); // Track seen IDs to prevent duplicates
        
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
            let chunk: T[];
            
            if (orderByField && lastItem !== undefined) {
                // ✅ FIXED: Use above/below with last item's value
                const lastValue = (lastItem as any)[orderByField];
                const baseOrderQuery = reverse 
                    ? table.orderBy(orderByField).reverse()
                    : table.orderBy(orderByField);
                
                if (reverse) {
                    // For reverse order, get items with value less than lastValue
                    chunk = await baseOrderQuery
                        .below(lastValue)
                        .limit(chunkSize)
                        .toArray() as T[];
                } else {
                    // For normal order, get items with value greater than lastValue
                    chunk = await baseOrderQuery
                        .above(lastValue)
                        .limit(chunkSize)
                        .toArray() as T[];
                }
            } else if (orderByField) {
                // First chunk with ordering
                chunk = await baseQuery.limit(chunkSize).toArray() as T[];
            } else {
                // No ordering - use ID-based pagination
                if (lastItem !== undefined) {
                    const lastId = (lastItem as any).id;
                    chunk = await table
                        .where(':id')
                        .above(lastId)
                        .limit(chunkSize)
                        .toArray() as T[];
                } else {
                    chunk = await table.limit(chunkSize).toArray() as T[];
                }
            }
            
            if (chunk.length === 0) break; // No more data
            
            // ✅ FIXED: Filter out duplicates and add to results
            const uniqueChunk = chunk.filter(item => {
                const id = (item as any).id;
                if (seenIds.has(id)) {
                    return false; // Skip duplicate
                }
                seenIds.add(id);
                return true;
            });
            
            allItems.push(...uniqueChunk);
            processed += uniqueChunk.length;
            
            // Get last item for next iteration
            if (uniqueChunk.length > 0) {
                lastItem = uniqueChunk[uniqueChunk.length - 1];
            }
            
            // Yield to main thread every chunk (except last)
            if (processed < count && uniqueChunk.length === chunkSize) {
                await yieldToMainThread();
            }
            
            // Safety check: if we got fewer items than expected, we're done
            if (uniqueChunk.length < chunkSize) {
                break;
            }
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

