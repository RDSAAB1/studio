"use client";
import React, { useState, useEffect } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';

export default function OnboardPage() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // State for creating new Group/Unit/Season
    const [companyName, setCompanyName] = useState('');
    const [subName, setSubName] = useState('');
    const [seasonName, setSeasonName] = useState('');

    // Selection State
    const [selectedBiz, setSelectedBiz] = useState(null);
    const [selectedSub, setSelectedSub] = useState(null);

    const fetchBusinesses = async () => {
        try {
            const auth = getFirebaseAuth();
            const userId = auth?.currentUser?.uid || "test-user-123";

            const res = await fetch('/api/d1-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://jrmd-sync-worker.traderramanduggal.workers.dev/onboard/list',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer jrmd2026', 'X-User-Id': userId }
                })
            });
            const data = await res.json();
            const list = data.businesses || [];
            setBusinesses(list);

            // Maintain selection if possible
            if (selectedBiz) {
                const b = list.find(x => x.id === selectedBiz.id);
                if (b) {
                    setSelectedBiz(b);
                    if (selectedSub) {
                        const s = b.subCompanies.find(x => x.id === selectedSub.id);
                        if (s) setSelectedSub(s);
                    }
                }
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => { 
        const timer = setTimeout(fetchBusinesses, 1000);
        return () => clearTimeout(timer);
    }, []);

    const createCompany = async () => {
        if (!companyName) return;
        setLoading(true);
        try {
            const userId = getFirebaseAuth()?.currentUser?.uid || "test-user-123";
            await fetch('/api/d1-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://jrmd-sync-worker.traderramanduggal.workers.dev/onboard/company',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer jrmd2026', 'X-User-Id': userId },
                    body: { name: companyName }
                })
            });
            setCompanyName('');
            setTimeout(fetchBusinesses, 500);
        } catch (e) {}
        setLoading(false);
    };

    const createSubCompany = async () => {
        if (!subName || !selectedBiz) return;
        setLoading(true);
        try {
            const userId = getFirebaseAuth()?.currentUser?.uid || "test-user-123";
            await fetch('/api/d1-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://jrmd-sync-worker.traderramanduggal.workers.dev/onboard/sub-company',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer jrmd2026', 'X-User-Id': userId },
                    body: { companyId: selectedBiz.id, name: subName }
                })
            });
            setSubName('');
            setTimeout(fetchBusinesses, 500);
        } catch (e) {}
        setLoading(false);
    };

    const createSeason = async () => {
        if (!seasonName || !selectedSub) return;
        setLoading(true);
        try {
            const userId = getFirebaseAuth()?.currentUser?.uid || "test-user-123";
            await fetch('/api/d1-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://jrmd-sync-worker.traderramanduggal.workers.dev/onboard/season',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer jrmd2026', 'X-User-Id': userId },
                    body: { companyId: selectedBiz.id, subCompanyId: selectedSub.id, name: seasonName }
                })
            });
            setSeasonName('');
            setTimeout(fetchBusinesses, 500);
        } catch (e) {}
        setLoading(false);
    };

    const cardStyle = { background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' };
    const btnStyle = { background: '#4f46e5', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
    const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', flex: 1 };

    return (
        <div style={{ padding: '40px', background: '#f1f5f9', minHeight: '100vh', fontFamily: 'sans-serif', color: '#1e293b' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#4f46e5', margin: '0' }}>BIZSUITE CLOUD HUB</h1>
                    <p style={{ color: '#64748b', fontSize: '18px' }}>Manage: Group → Unit → Season</p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 1fr', gap: '20px' }}>
                    
                    {/* STEP 1: COMPANY (GROUP) */}
                    <div>
                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0 }}>1. Create Group</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Jagdambey Group" />
                                <button style={btnStyle} onClick={createCompany}>Add</button>
                            </div>
                        </div>
                        <div style={cardStyle}>
                            <h4 style={{ marginTop: 0 }}>Your Groups:</h4>
                            {businesses.map(b => (
                                <div key={b.id} onClick={() => { setSelectedBiz(b); setSelectedSub(null); }} 
                                     style={{ padding: '12px', borderRadius: '8px', border: '2px solid', marginBottom: '8px', cursor: 'pointer',
                                              background: selectedBiz?.id === b.id ? '#f5f3ff' : 'white',
                                              borderColor: selectedBiz?.id === b.id ? '#4f46e5' : '#f1f5f9' }}>
                                    <strong>{b.name}</strong>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>{b.id}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* STEP 2: SUB-COMPANY (UNIT) */}
                    <div>
                        {selectedBiz ? (
                            <>
                                <div style={cardStyle}>
                                    <h3 style={{ marginTop: 0 }}>2. Create Unit in {selectedBiz.name}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input style={inputStyle} value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g. Rice Mill A" />
                                        <button style={{ ...btnStyle, background: '#7c3aed' }} onClick={createSubCompany}>Add</button>
                                    </div>
                                </div>
                                <div style={cardStyle}>
                                    <h4 style={{ marginTop: 0 }}>Available Units:</h4>
                                    {selectedBiz.subCompanies?.map(s => (
                                        <div key={s.id} onClick={() => setSelectedSub(s)} 
                                             style={{ padding: '12px', borderRadius: '8px', border: '2px solid', marginBottom: '8px', cursor: 'pointer',
                                                      background: selectedSub?.id === s.id ? '#f0fdf4' : 'white',
                                                      borderColor: selectedSub?.id === s.id ? '#10b981' : '#f1f5f9' }}>
                                            <strong>{s.name}</strong>
                                            <div style={{ fontSize: '10px', color: '#64748b' }}>{s.id}</div>
                                        </div>
                                    ))}
                                    {selectedBiz.subCompanies?.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>No units found. Add one above.</p>}
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Select a Group first</div>
                        )}
                    </div>

                    {/* STEP 3: SEASON (YEAR) */}
                    <div>
                        {selectedSub ? (
                            <>
                                <div style={cardStyle}>
                                    <h3 style={{ marginTop: 0 }}>3. Create Season for {selectedSub.name}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input style={inputStyle} value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="e.g. 2024-25" />
                                        <button style={{ ...btnStyle, background: '#059669' }} onClick={createSeason}>Add</button>
                                    </div>
                                </div>
                                <div style={cardStyle}>
                                    <h4 style={{ marginTop: 0 }}>Configured Seasons:</h4>
                                    {selectedSub.seasons?.map(s => (
                                        <div key={s.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px' }}>
                                            <strong>{s.name}</strong>
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.id}</div>
                                        </div>
                                    ))}
                                    {selectedSub.seasons?.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>No seasons found. Add one above.</p>}
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Select a Unit first</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
