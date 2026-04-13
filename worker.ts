/**
 * BIZSUITE CLOUDFLARE SYNC WORKER (K-V COMPATIBLE)
 * Handles synchronization with Multi-tenant (ERP) Scoping.
 */

export default {
    async fetch(request, env) {
        const SECRET_SYNC_TOKEN = "jrmd2026"; 

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Company-Id, X-Sub-Company-Id, X-Year, X-User-Id",
            "Access-Control-Max-Age": "86400",
        };

        if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

        const authHeader = request.headers.get("Authorization");
        if (!authHeader || authHeader !== `Bearer ${SECRET_SYNC_TOKEN}`) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ERP Context Headers (Scoping)
        const companyId = request.headers.get("X-Company-Id") || "root";
        const subCompanyId = request.headers.get("X-Sub-Company-Id") || "main";
        const year = request.headers.get("X-Year") || "none";
        const userId = request.headers.get("X-User-Id") || "unknown";

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            // --- ONBOARDING & MASTER HIERARCHY ---
            if (path.startsWith("/onboard")) {
                // GET /onboard/list: List nested hierarchy
                if (request.method === "GET" && path === "/onboard/list") {
                    const { results: companies } = await env.DB.prepare(
                        `SELECT c.id, c.name, m.role FROM companies c 
                         JOIN memberships m ON c.id = m.company_id 
                         WHERE m.user_id = ?`
                    ).bind(userId).all();
                    
                    const businesses = await Promise.all(companies.map(async (company) => {
                        // Get Sub-Companies
                        const { results: subCompanies } = await env.DB.prepare(
                            "SELECT id, name FROM sub_companies WHERE company_id = ?"
                        ).bind(company.id).all();

                        // Get Seasons for each Sub-Company
                        const subsWithSeasons = await Promise.all(subCompanies.map(async (sub) => {
                            const { results: seasons } = await env.DB.prepare(
                                "SELECT id, name FROM seasons WHERE sub_company_id = ?"
                            ).bind(sub.id).all();
                            return { ...sub, seasons };
                        }));

                        return { ...company, subCompanies: subsWithSeasons };
                    }));

                    return new Response(JSON.stringify({ businesses }), { headers: corsHeaders });
                }

                // POST /onboard/company: Create a new Business Group
                if (request.method === "POST" && path === "/onboard/company") {
                    const { name } = await request.json();
                    const companyId = "biz_" + Math.random().toString(36).substr(2, 9);
                    const now = Date.now();
                    await env.DB.batch([
                        env.DB.prepare("INSERT INTO companies (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)").bind(companyId, name, userId, now),
                        env.DB.prepare("INSERT INTO memberships (user_id, company_id, role, added_at) VALUES (?, ?, ?, ?)").bind(userId, companyId, 'owner', now)
                    ]);
                    return new Response(JSON.stringify({ success: true, companyId }), { headers: corsHeaders });
                }

                // POST /onboard/sub-company: Create a Unit/Factory
                if (request.method === "POST" && path === "/onboard/sub-company") {
                    const { companyId, name } = await request.json();
                    const subId = "sub_" + Math.random().toString(36).substr(2, 9);
                    await env.DB.prepare(
                        "INSERT INTO sub_companies (id, company_id, name, created_at) VALUES (?, ?, ?, ?)"
                    ).bind(subId, companyId, name, Date.now()).run();
                    return new Response(JSON.stringify({ success: true, subId }), { headers: corsHeaders });
                }

                // POST /onboard/season: Create a context (Year/Season) inside a Sub-Company
                if (request.method === "POST" && path === "/onboard/season") {
                    const { companyId, subCompanyId, name } = await request.json();
                    const seasonId = "sea_" + Math.random().toString(36).substr(2, 9);
                    
                    // Explicitly define columns and binds to avoid any schema mapping errors
                    await env.DB.prepare(
                        "INSERT INTO seasons (id, company_id, name, created_at, is_active, sub_company_id) VALUES (?, ?, ?, ?, 1, ?)"
                    ).bind(seasonId, companyId, name, Date.now(), subCompanyId).run();

                    return new Response(JSON.stringify({ success: true, seasonId }), { headers: corsHeaders });
                }
            }

            // --- SYNC ENGINE (DATA SCOPING) ---
            if (path === "/sync") {
                if (request.method === "DELETE") {
                    const collection = url.searchParams.get("collection");
                    if (!collection) throw new Error("Missing collection");
                    
                    // Scoped delete: only delete records belonging to this tenant/year
                    await env.DB.prepare(
                        `DELETE FROM ${collection} WHERE _company_id = ? AND _sub_company_id = ? AND _year = ?`
                    ).bind(companyId, subCompanyId, year).run();
                    
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

                if (request.method === "GET") {
                    const collection = url.searchParams.get("collection");
                    const since = parseInt(url.searchParams.get("since") || "0");

                    if (collection) {
                        // Legacy: Scoped pull for specific collection
                        const { results } = await env.DB.prepare(
                            `SELECT id, data, updated_at, 'upsert' as operation FROM ${collection} 
                             WHERE _company_id = ? AND _sub_company_id = ? AND _year = ? AND updated_at >= ? 
                             ORDER BY updated_at ASC`
                        ).bind(companyId, subCompanyId, year, since).all();
                        return new Response(JSON.stringify({ results }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" }
                        });
                    } else {
                        // NEW: Optimized Global Pull from Notice Board (_sync_log)
                        const { results } = await env.DB.prepare(
                            `SELECT docId as id, collection, operation, data, updated_at, _company_id, _sub_company_id, _year FROM _sync_log 
                             WHERE _company_id = ? AND _sub_company_id = ? AND (_year = ? OR _year = 'COMMON') AND updated_at >= ? 
                             ORDER BY updated_at ASC LIMIT 1000`
                        ).bind(companyId, subCompanyId, year, since).all();
                        
                        return new Response(JSON.stringify({ results }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" }
                        });
                    }
                }

                if (request.method === "POST") {
                    const { collection, changes } = await request.json();
                    const now = Date.now();
                    const batch = [];

                    for (const change of changes) {
                        const { id, data, operation, updated_at: clientTime } = change;
                        const finalTime = clientTime || now;
                        const action = operation === 'delete' ? 'DELETE' : 'UPSERT';
                        
                        // 1. Log to Global Notice Board (_sync_log) for instant cross-device sync
                        batch.push(env.DB.prepare(
                            `INSERT OR REPLACE INTO _sync_log 
                             (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                        ).bind(`${companyId}:${subCompanyId}:${year}:${collection}:${id}`, collection, id, operation || 'upsert', 
                               operation === 'delete' ? null : (typeof data === 'string' ? data : JSON.stringify(data)),
                               finalTime, companyId, subCompanyId, year));

                        // 2. Perform the Action on the Main Table
                        if (operation === 'delete') {
                            batch.push(env.DB.prepare(
                                `DELETE FROM ${collection} WHERE id = ? AND _company_id = ?`
                            ).bind(id, companyId));
                        } else {
                            const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
                            batch.push(env.DB.prepare(
                                `INSERT OR REPLACE INTO ${collection} 
                                 (id, data, _company_id, _sub_company_id, _year, updated_at, _last_user) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`
                            ).bind(id, jsonStr, companyId, subCompanyId, year, finalTime, userId));
                        }
                    }

                    if (batch.length > 0) await env.DB.batch(batch);
                    return new Response(JSON.stringify({ success: true, count: batch.length }), { headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }
};
