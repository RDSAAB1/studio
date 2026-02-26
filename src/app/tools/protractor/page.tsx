'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Download, Calculator, RefreshCw, Eye } from 'lucide-react';

interface DataPoint {
  id: number;
  x: number;
  y: number;
  l1: number; // Layer 1 %
  l2: number; // Layer 2 %
  l3: number; // Layer 3 %
  l4: number; // Layer 4 %
}

interface RegressionResult {
  a: number;
  b: number;
  c: number;
  formula: string;
  error: string | null;
}

export default function ProtractorDesigner() {
  // --- State ---
  const [points, setPoints] = useState<DataPoint[]>([
    { id: 1, x: 0, y: 90, l1: 4, l2: 4, l3: 4, l4: 4 },
    { id: 2, x: 5, y: 80, l1: 8, l2: 10, l3: 12, l4: 14 },
    { id: 3, x: 10, y: 71, l1: 12, l2: 16, l3: 18, l4: 24 },
  ]);
  const [pointCount, setPointCount] = useState<number>(30);
  const [radius, setRadius] = useState<number>(300);
  const [tickInterval, setTickInterval] = useState<number>(3);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [mirrorQuadrants, setMirrorQuadrants] = useState<boolean>(false);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  
  const [regression, setRegression] = useState<RegressionResult>({ a: 0, b: 0, c: 0, formula: '', error: null });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Logic: Lagrange Interpolation (Generic) ---
  const interpolateValue = useCallback((targetX: number, field: keyof DataPoint) => {
    let result = 0;
    for (let i = 0; i < points.length; i++) {
      let term = points[i][field] as number;
      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
            if (points[i].x === points[j].x) continue; 
            term *= (targetX - points[j].x) / (points[i].x - points[j].x);
        }
      }
      result += term;
    }
    return result;
  }, [points]);

  const calculateInterpolation = useCallback((x: number) => interpolateValue(x, 'y'), [interpolateValue]);

  // --- Logic: Quadratic Regression (Legacy, replaced by Lagrange) ---
  const calculateRegression = useCallback(() => {
    if (points.length < 2) {
      setRegression({ a: 0, b: 0, c: 0, formula: 'Need at least 2 points', error: 'Insufficient data' });
      return;
    }
    setRegression({ 
        a: 0, b: 0, c: 0, 
        formula: `Polynomial Degree ${points.length - 1}`, 
        error: null 
    });
  }, [points]);

  useEffect(() => {
    calculateRegression();
  }, [points, calculateRegression]);

  // Auto-expand total points if user defines a point beyond the current range
  useEffect(() => {
      const maxX = Math.max(...points.map(p => p.x));
      if (maxX > pointCount) {
          setPointCount(maxX);
      }
  }, [points, pointCount]);

  // --- Logic: Canvas Drawing ---
  const drawProtractor = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, isExport: boolean = false) => {
    // Settings
    const padding = isExport ? 16 : 14;
    const maxOuterRadius = mirrorQuadrants ? Math.min(width, height) / 2 - padding : height - 2 * padding;
    const safeMaxOuterRadius = Math.max(80, maxOuterRadius);
    const effectiveRadius = autoFit ? Math.max(80, Math.min(radius, safeMaxOuterRadius - 95)) : radius;

    const cx = width / 2;
    const cy = mirrorQuadrants ? height / 2 : height - padding;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw Background Grid (Only if enabled)
    if (showGrid && !isExport) {
        ctx.strokeStyle = '#e2e8f0'; // slate-200
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(width, cy); // Horizontal Baseline
        ctx.moveTo(cx, 0); ctx.lineTo(cx, height); // Vertical Center
        ctx.stroke();
    }

    const outerBandOuter = effectiveRadius + 95;
    const outerBandInner = effectiveRadius + 50;
    const mainBandOuter = effectiveRadius + 50;
    const mainBandInner = effectiveRadius - 10;

    ctx.beginPath();
    ctx.arc(cx, cy, outerBandOuter, Math.PI, 0);
    ctx.arc(cx, cy, outerBandInner, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#e5e7eb';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, mainBandOuter, Math.PI, 0);
    ctx.arc(cx, cy, mainBandInner, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#0891b2';
    ctx.fill();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, outerBandOuter, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, mainBandOuter, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - outerBandOuter, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + outerBandOuter, cy);
    ctx.stroke();

    // Full guide lines only at 0°, 45°, 90°
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1;
    [0, 45, 90].forEach((degVal) => {
        const rad = (-degVal * Math.PI) / 180;
        const gx = cx + outerBandOuter * Math.cos(rad);
        const gy = cy + outerBandOuter * Math.sin(rad);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(gx, gy);
        ctx.stroke();
    });

    // 4. Center Origin
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ef4444'; // Red center
    ctx.fill();
    
    // Plot Points based on Formula
    if (regression.error) return;

    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; // Labels sit above lines

    // Loop through points
    for (let i = 0; i <= pointCount; i++) {
        let val = interpolateValue(i, 'y');
        let isClipped = false;
        
        // Clamp 0-90
        if (val < 0) { val = 0; isClipped = true; } 
        else if (val > 90) { val = 90; isClipped = true; }
        
        // 180 Degree Logic:
        let angles = [-val]; 
        if (mirrorQuadrants) {
            angles = [-val, -180 + val];
        }

        angles.forEach(deg => {
            const rad = (deg * Math.PI) / 180;
            const px = cx + effectiveRadius * Math.cos(rad);
            const py = cy + effectiveRadius * Math.sin(rad);
            
            // Check Styling Condition
            const isKeyPoint = points.some(p => p.x === i);
            const isMajorTick = (i % tickInterval === 0) || isKeyPoint;
            const isHighlight = (i === highlightIndex);
            
            let tickLen = 16;
            let tickWidth = 1.5;
            let tickColor = '#ef4444';

            if (isHighlight) {
                tickLen = 44; 
                tickWidth = 4; 
                tickColor = '#dc2626';
            } else if (isKeyPoint) {
                tickLen = 36;
                tickWidth = 3;
                tickColor = '#0f172a';
            } else if (isMajorTick) {
                tickLen = 30;
                tickWidth = 2.5;
                tickColor = '#0f172a';
            }
            
            if (isClipped && !isHighlight) tickColor = '#ef4444'; 

            const tickOuterR = mainBandOuter;
            const tickInnerR = mainBandOuter - tickLen;
            const tx = cx + tickInnerR * Math.cos(rad);
            const ty = cy + tickInnerR * Math.sin(rad);
            const ox = cx + tickOuterR * Math.cos(rad);
            const oy = cy + tickOuterR * Math.sin(rad);

            ctx.strokeStyle = tickColor;
            ctx.lineWidth = tickWidth;
            
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(ox, oy);
            ctx.stroke();

            const shouldShowDegreeLabel = isHighlight || (i % 10 === 0);

            if (showLabels && shouldShowDegreeLabel) {
                ctx.save();

                const degreeR = (outerBandOuter + outerBandInner) / 2;

                const dx = cx + degreeR * Math.cos(rad);
                const dy = cy + degreeR * Math.sin(rad);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillStyle = '#0f172a';
                ctx.font = isHighlight ? 'bold 26px sans-serif' : 'bold 22px sans-serif';
                ctx.fillText(`${i}`, dx, dy);

                ctx.restore();
            }
        });
    }
  }, [regression, pointCount, radius, showLabels, showGrid, points, highlightIndex, mirrorQuadrants, tickInterval, interpolateValue, autoFit]);


  useEffect(() => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    if (!canvas || !preview) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeAndDraw = () => {
      const rect = preview.getBoundingClientRect();
      const logicalSize = Math.max(320, Math.floor(Math.min(rect.width, rect.height)));
      const dpr = window.devicePixelRatio || 1;

      canvas.style.width = `${logicalSize}px`;
      canvas.style.height = `${logicalSize}px`;
      canvas.width = Math.floor(logicalSize * dpr);
      canvas.height = Math.floor(logicalSize * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalSize, logicalSize);
      drawProtractor(ctx, logicalSize, logicalSize, false);
    };

    const ro = new ResizeObserver(resizeAndDraw);
    ro.observe(preview);
    resizeAndDraw();

    return () => ro.disconnect();
  }, [drawProtractor]);

  // --- Handlers ---
  const handlePointChange = (id: number, field: keyof DataPoint, value: string) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: Number(value) } : p));
  };

  const addPoint = () => {
    const lastId = points.length > 0 ? Math.max(...points.map(p => p.id)) : 0;
    const lastX = points.length > 0 ? points[points.length - 1].x : -1;
    setPoints([...points, { id: lastId + 1, x: lastX + 1, y: 0, l1: 50, l2: 50, l3: 50, l4: 50 }]);
  };

  const removePoint = (id: number) => {
    setPoints(prev => prev.filter(p => p.id !== id));
  };

  const downloadCanvas = () => {
    const scale = 4; // High Quality (3200x3200)
    const logicalSize = 800;
    
    const canvas = document.createElement('canvas');
    canvas.width = logicalSize * scale;
    canvas.height = logicalSize * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Fill White Background (Professional)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Scale Context
    ctx.scale(scale, scale);

    // 3. Draw
    drawProtractor(ctx, logicalSize, logicalSize, true);

    // 4. Export
    const link = document.createElement('a');
    link.download = 'protractor-design-high-res.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const [testIndex, setTestIndex] = useState<string>('');
  const [testResult, setTestResult] = useState<number | null>(null);

  const calculateTest = () => {
    if (regression.error || !testIndex) return;
    const i = Number(testIndex); // User inputs the "Tick Index" (0..TotalPoints)
    
    // Strict Integer lookup
    const y = calculateInterpolation(i);
    setTestResult(y);
    setHighlightIndex(i); // Highlight the visual tick
  };

  const handleSliderChange = (values: number[]) => {
    setPointCount(values[0]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row gap-6 p-4">
      {/* Left Panel: Controls */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Key Points
            </CardTitle>
            <CardDescription>
                Define 3 key points (e.g. Start #0, Middle, End) to shape the curve. The rest will be interpolated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-16">Pt #</TableHead>
                        <TableHead className="w-16">Angle</TableHead>
                        <TableHead className="w-12 text-xs text-sky-500">L1 %</TableHead>
                        <TableHead className="w-12 text-xs text-blue-500">L2 %</TableHead>
                        <TableHead className="w-12 text-xs text-slate-500">L3 %</TableHead>
                        <TableHead className="w-12 text-xs text-gray-400">L4 %</TableHead>
                        <TableHead className="w-10"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {points.map((point) => (
                        <TableRow key={point.id}>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.x} 
                                    onChange={(e) => handlePointChange(point.id, 'x', e.target.value)}
                                    className="h-7 w-full px-1 text-center"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.y} 
                                    onChange={(e) => handlePointChange(point.id, 'y', e.target.value)}
                                    className="h-7 w-full px-1 text-center"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.l1 ?? 0} 
                                    onChange={(e) => handlePointChange(point.id, 'l1', e.target.value)}
                                    className="h-7 w-full px-1 text-center bg-sky-50"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.l2 ?? 0} 
                                    onChange={(e) => handlePointChange(point.id, 'l2', e.target.value)}
                                    className="h-7 w-full px-1 text-center bg-blue-50"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.l3 ?? 0} 
                                    onChange={(e) => handlePointChange(point.id, 'l3', e.target.value)}
                                    className="h-7 w-full px-1 text-center bg-slate-50"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input 
                                    type="number" 
                                    value={point.l4 ?? 0} 
                                    onChange={(e) => handlePointChange(point.id, 'l4', e.target.value)}
                                    className="h-7 w-full px-1 text-center bg-gray-50"
                                />
                            </TableCell>
                            <TableCell className="p-1">
                                <Button variant="ghost" size="icon" onClick={() => removePoint(point.id)} className="h-7 w-7 text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={addPoint}>
                <Plus className="h-4 w-4 mr-2" /> Add Point
            </Button>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Regression Result</CardTitle>
            </CardHeader>
            <CardContent>
                {regression.error ? (
                    <div className="text-destructive font-medium">{regression.error}</div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Interpolation Mode:</div>
                            <div className="text-lg font-mono font-bold text-primary p-2 bg-muted rounded border">
                                {regression.formula}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                                Using Lagrange Polynomial Interpolation to pass exactly through all points.
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t space-y-2">
                            <Label>Test Prediction & Highlight</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Enter Point #" 
                                    value={testIndex} 
                                    onChange={(e) => setTestIndex(e.target.value)}
                                    type="number"
                                />
                                <Button onClick={calculateTest} variant="secondary">Check</Button>
                            </div>
                            {testResult !== null && (
                                <div className="space-y-1">
                                    <div className="text-sm font-medium text-green-500">
                                        Angle: {testResult.toFixed(4)}°
                                    </div>
                                    { (testResult < 0 || testResult > 90) && (
                                        <div className="text-xs text-amber-500">
                                            Warning: Angle outside 0-90° range.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
        
        {/* Calculated Table Preview */}
        <Card className="max-h-60 overflow-y-auto">
             <CardHeader className="py-3">
                <CardTitle className="text-sm">Calculated Values Preview</CardTitle>
             </CardHeader>
             <CardContent className="py-0 pb-3">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="h-8 text-xs w-12">Pt</TableHead>
                            <TableHead className="h-8 text-xs w-16">Angle</TableHead>
                            <TableHead className="h-8 text-xs text-sky-500 w-12">L1</TableHead>
                            <TableHead className="h-8 text-xs text-blue-500 w-12">L2</TableHead>
                            <TableHead className="h-8 text-xs text-slate-500 w-12">L3</TableHead>
                            <TableHead className="h-8 text-xs text-gray-400 w-12">L4</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: Math.min(pointCount + 1, 101) }).map((_, i) => {
                             const val = interpolateValue(i, 'y');
                             const l1 = interpolateValue(i, 'l1');
                             const l2 = interpolateValue(i, 'l2');
                             const l3 = interpolateValue(i, 'l3');
                             const l4 = interpolateValue(i, 'l4');
                             const isInvalid = val < 0 || val > 90;
                             
                             return (
                                <TableRow key={i} className="h-7 hover:bg-slate-50">
                                    <TableCell className="py-1 text-xs font-medium">{i}</TableCell>
                                    <TableCell className={`py-1 text-xs ${isInvalid ? 'text-destructive font-bold' : ''}`}>
                                        {val.toFixed(2)}°
                                    </TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">{l1.toFixed(1)}%</TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">{l2.toFixed(1)}%</TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">{l3.toFixed(1)}%</TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">{l4.toFixed(1)}%</TableCell>
                                </TableRow>
                             );
                        })}
                        {pointCount > 100 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">...</TableCell></TableRow>}
                    </TableBody>
                </Table>
             </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Design Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Total Points (0-90°)</Label>
                        <span className="text-sm text-muted-foreground">{pointCount}</span>
                    </div>
                    <Slider 
                        value={[pointCount]} 
                        onValueChange={handleSliderChange} 
                        min={3} 
                        max={100} 
                        step={1} 
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Highlight Line Interval</Label>
                        <span className="text-sm text-muted-foreground">Every {tickInterval} points</span>
                    </div>
                    <Slider 
                        value={[tickInterval]} 
                        onValueChange={(v) => setTickInterval(v[0])} 
                        min={1} 
                        max={20} 
                        step={1} 
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Radius (px)</Label>
                        <span className="text-sm text-muted-foreground">{radius}</span>
                    </div>
                    <Slider 
                        value={[radius]} 
                        onValueChange={(v) => setRadius(v[0])} 
                        min={100} 
                        max={500} 
                        step={10} 
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="auto-fit">Auto Fit</Label>
                    <Switch id="auto-fit" checked={autoFit} onCheckedChange={setAutoFit} />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="mirror-quadrants">Mirror Full Circle</Label>
                    <Switch id="mirror-quadrants" checked={mirrorQuadrants} onCheckedChange={setMirrorQuadrants} />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="show-labels">Show Labels</Label>
                    <Switch id="show-labels" checked={showLabels} onCheckedChange={setShowLabels} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="show-grid">Show Grid</Label>
                    <Switch id="show-grid" checked={showGrid} onCheckedChange={setShowGrid} />
                </div>

                <Button className="w-full" onClick={downloadCanvas}>
                    <Download className="h-4 w-4 mr-2" /> Export Design
                </Button>
            </CardContent>
        </Card>
      </div>

      {/* Right Panel: Preview */}
      <div ref={previewRef} className="w-full lg:w-2/3 bg-slate-100 rounded-xl border border-slate-300 relative overflow-hidden flex items-center justify-center shadow-inner">
        <canvas 
            ref={canvasRef}
            className="block max-w-full max-h-full"
        />
      </div>
    </div>
  );
}
