
"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Info } from 'lucide-react';
import { format, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears, addDays, addMonths, addYears } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';


const CalculatorButton = ({ onClick, children, className }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <Button variant="outline" className={`h-8 text-base ${className}`} onClick={onClick}>{children}</Button>
);

const ScientificCalculator = () => {
    const [input, setInput] = useState('0');
    const [isResult, setIsResult] = useState(false);

    const handleInput = (val: string) => {
        if (isResult) {
            setInput(val);
            setIsResult(false);
        } else {
            setInput(prev => (prev === '0' && val !== '.') ? val : prev + val);
        }
    };
    
    const handleOperator = (op: string) => {
        setIsResult(false);
        setInput(prev => `${prev} ${op} `);
    };

    const handleClear = () => {
        setInput('0');
        setIsResult(false);
    };
    
    const handleBackspace = () => {
        if (isResult) {
            handleClear();
            return;
        }
        setInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    }
    
    const evaluateExpression = (expr: string) => {
        try {
            let evalString = expr
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/π/g, 'Math.PI')
                .replace(/e/g, 'Math.E');

            // Avoid octal literals
            evalString = evalString.replace(/\b0+(?![.eE])/g, '');
            
            // Very basic security check for allowed characters
            if (/[^0-9\s.()+\-*/%MathPIEsqrtpowcossintanlog10]/.test(evalString)) {
                return 'Error';
            }

            const result = new Function('return ' + evalString)();
            if (isNaN(result) || !isFinite(result)) {
                return 'Error';
            }
            return String(result);
        } catch (error) {
            return null; // Return null on error to distinguish from a valid 'Error' string result
        }
    };

    const handleEquals = () => {
        const result = evaluateExpression(input);
        if (result !== null) {
            setInput(result);
            setIsResult(true);
        } else {
            setInput('Error');
            setIsResult(true);
        }
    };
    
    const handleFunction = (func: string) => {
        setIsResult(false);
        let expression;
        if (func === '√') {
            expression = `Math.sqrt(${input})`;
        } else if (func === 'x²') {
            expression = `Math.pow(${input}, 2)`;
        } else if (func === 'x³') {
            expression = `Math.pow(${input}, 3)`;
        } else if (func === '%') {
             expression = `(${input} / 100)`;
        } else if (func === '!') { // Factorial
            try {
                const num = parseInt(input);
                if (num < 0) throw new Error("Factorial of negative number is not defined.");
                let result = 1;
                for (let i = 2; i <= num; i++) {
                    result *= i;
                }
                setInput(String(result));
                setIsResult(true);
            } catch {
                setInput("Error");
                setIsResult(true);
            }
            return;
        } else {
            expression = `Math.${func}(${input})`;
        }
        
        const result = evaluateExpression(expression);
        if (result !== null) {
            setInput(result);
            setIsResult(true);
        } else {
             // If function fails, just wrap the input in the function call
            setInput(expression.replace(/\b\d+\b/, input));
        }
    }

    const displayValue = useMemo(() => {
        if (isResult) return input;
        
        const result = evaluateExpression(input);
        if (result !== null && result !== input) {
            return result;
        }
        return input;
    }, [input, isResult]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            const { key } = event;

            if (/[0-9]/.test(key)) {
                handleInput(key);
            } else if (key === '.') {
                handleInput('.');
            } else if (key === '+') {
                handleOperator('+');
            } else if (key === '-') {
                handleOperator('-');
            } else if (key === '*') {
                handleOperator('×');
            } else if (key === '/') {
                handleOperator('÷');
            } else if (key === '=') {
                handleOperator('+');
            } else if (key === '[') {
                handleOperator('×');
            } else if (key === ']') {
                handleOperator('÷');
            } else if (key === 'Enter') {
                handleEquals();
            } else if (key === 'Backspace') {
                handleBackspace();
            } else if (key === 'Escape' || key === 'Delete') {
                handleClear();
            } else if (key === '(') {
                handleInput('(');
            } else if (key === ')') {
                handleInput(')');
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [input, isResult]);


    return (
        <div className="p-4 space-y-2">
            <Card className="bg-muted/30 p-2 mb-2">
                <CardContent className="p-1 text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Info size={16} className="flex-shrink-0" />
                    <p className="font-mono">Enter → = | [ → × | ] → ÷ | = → + | Del/Esc → AC</p>
                </CardContent>
            </Card>
            <Input type="text" readOnly value={input} className="h-16 text-2xl text-right font-mono" />
            <div className="grid grid-cols-5 gap-2">
                <CalculatorButton onClick={() => handleFunction('sin')}>sin</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('cos')}>cos</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('tan')}>tan</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('log10')}>log</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('log')}>ln</CalculatorButton>

                <CalculatorButton onClick={() => handleFunction('√')}>√</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('x²')}>x²</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('(')}>(</CalculatorButton>
                <CalculatorButton onClick={() => handleInput(')')}>)</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('!')}>x!</CalculatorButton>

                <CalculatorButton onClick={() => handleInput('π')}>π</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('7')}>7</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('8')}>8</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('9')}>9</CalculatorButton>
                <CalculatorButton onClick={() => handleOperator('÷')}>÷</CalculatorButton>
                
                <CalculatorButton onClick={() => handleInput('e')}>e</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('4')}>4</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('5')}>5</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('6')}>6</CalculatorButton>
                <CalculatorButton onClick={() => handleOperator('×')}>×</CalculatorButton>

                <CalculatorButton onClick={handleClear} className="bg-destructive/80 text-destructive-foreground">AC</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('1')}>1</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('2')}>2</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('3')}>3</CalculatorButton>
                <CalculatorButton onClick={() => handleOperator('-')}>-</CalculatorButton>
                
                <CalculatorButton onClick={handleBackspace}>⌫</CalculatorButton>
                <CalculatorButton onClick={() => handleInput('0')}>0</CalculatorButton>
                <CalculatorButton onClick={() => handleFunction('%')}>%</CalculatorButton>
                <CalculatorButton onClick={handleEquals} className="bg-primary text-primary-foreground">=</CalculatorButton>
                <CalculatorButton onClick={() => handleOperator('+')}>+</CalculatorButton>
            </div>
        </div>
    );
};

const unitConfig = {
    Weight: { Kilogram: 1, Quintal: 100, Tonne: 1000, Gram: 0.001 },
    Length: { Meter: 1, Kilometer: 1000, Centimeter: 0.01, Millimeter: 0.001, Foot: 0.3048, Inch: 0.0254 },
    Area: { 'Square Meter': 1, 'Square Foot': 0.092903, 'Acre': 4046.86 },
    Volume: { 'Liter': 1, 'Milliliter': 0.001, 'Cubic Meter': 1000 },
    Temperature: { 
        Celsius: { toBase: (c: number) => c, fromBase: (k: number) => k }, 
        Fahrenheit: { toBase: (f: number) => (f - 32) * 5/9, fromBase: (k: number) => (k * 9/5) + 32 }, 
        Kelvin: { toBase: (k: number) => k - 273.15, fromBase: (c: number) => c + 273.15 }
    },
};

const UnitConverter = () => {
    const [category, setCategory] = useState<keyof typeof unitConfig>('Weight');
    const [fromUnit, setFromUnit] = useState<string>('Kilogram');
    const [toUnit, setToUnit] = useState<string>('Quintal');
    const [fromValue, setFromValue] = useState('1');
    const [toValue, setToValue] = useState('');

    useEffect(() => {
        const convert = () => {
            if (fromValue === '') {
                setToValue('');
                return;
            }
            const val = parseFloat(fromValue);
            if (isNaN(val)) return;

            if (category === 'Temperature') {
                const tempConf = unitConfig.Temperature;
                const from = tempConf[fromUnit as keyof typeof tempConf];
                const to = tempConf[toUnit as keyof typeof tempConf];
                const baseValue = from.toBase(val); // Convert to Celsius (our base)
                const result = to.fromBase(baseValue);
                setToValue(result.toFixed(4));
            } else {
                const catConf = unitConfig[category as 'Weight' | 'Length' | 'Area' | 'Volume'];
                const fromFactor = catConf[fromUnit as keyof typeof catConf];
                const toFactor = catConf[toUnit as keyof typeof catConf];
                const result = (val * fromFactor) / toFactor;
                setToValue(result.toString());
            }
        };
        convert();
    }, [fromValue, fromUnit, toUnit, category]);
    
    useEffect(() => {
        const units = Object.keys(unitConfig[category]);
        setFromUnit(units[0]);
        setToUnit(units[1]);
        setFromValue('1');
    }, [category]);
    
    const units = Object.keys(unitConfig[category]);

    return (
        <div className="p-4 space-y-4">
             <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                    <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        {Object.keys(unitConfig).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                 <div className="flex-1 space-y-1">
                    <Label>From</Label>
                    <Input type="number" value={fromValue} onChange={(e) => setFromValue(e.target.value)} className="h-8" />
                    <Select value={fromUnit} onValueChange={setFromUnit}>
                         <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {units.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex-1 space-y-1">
                    <Label>To</Label>
                    <Input type="text" readOnly value={toValue} className="h-8" />
                    <Select value={toUnit} onValueChange={setToUnit}>
                         <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                        <SelectContent>
                           {units.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
};

const GSTCalculator = () => {
    const [amount, setAmount] = useState('1000');
    const [gstRate, setGstRate] = useState('18');
    const [calculationType, setCalculationType] = useState<'add' | 'remove'>('add');
    const [result, setResult] = useState({
        baseAmount: '',
        gstAmount: '',
        totalAmount: '',
    });

    useEffect(() => {
        const principalAmount = parseFloat(amount);
        const rate = parseFloat(gstRate);

        if (isNaN(principalAmount) || isNaN(rate)) {
            setResult({ baseAmount: '', gstAmount: '', totalAmount: '' });
            return;
        }

        if (calculationType === 'add') {
            const gstAmount = (principalAmount * rate) / 100;
            const totalAmount = principalAmount + gstAmount;
            setResult({
                baseAmount: principalAmount.toFixed(2),
                gstAmount: gstAmount.toFixed(2),
                totalAmount: totalAmount.toFixed(2),
            });
        } else { // remove
            const baseAmount = principalAmount / (1 + rate / 100);
            const gstAmount = principalAmount - baseAmount;
            setResult({
                baseAmount: baseAmount.toFixed(2),
                gstAmount: gstAmount.toFixed(2),
                totalAmount: principalAmount.toFixed(2),
            });
        }
    }, [amount, gstRate, calculationType]);

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <Label htmlFor="gst-amount">Amount</Label>
                <Input id="gst-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8"/>
            </div>
            <div className="space-y-1">
                <Label htmlFor="gst-rate">GST Rate (%)</Label>
                <Input id="gst-rate" type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="h-8"/>
            </div>
            <div className="space-y-2">
                <Label>Calculation Type</Label>
                <Select value={calculationType} onValueChange={(v) => setCalculationType(v as any)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="add">Add GST</SelectItem>
                        <SelectItem value="remove">Remove GST</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Card className="bg-muted/50 p-4 space-y-2 mt-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Amount:</span><span className="font-semibold">{result.baseAmount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST Amount:</span><span className="font-semibold">{result.gstAmount}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span className="text-foreground">Total Amount:</span><span className="text-primary">{result.totalAmount}</span></div>
            </Card>
        </div>
    );
};

const DateCalculator = () => {
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [diff, setDiff] = useState({ years: 0, months: 0, weeks: 0, days: 0 });

    const [calcDate, setCalcDate] = useState<Date | undefined>(new Date());
    const [addValue, setAddValue] = useState('0');
    const [addUnit, setAddUnit] = useState<'days' | 'months' | 'years'>('days');
    const [resultDate, setResultDate] = useState<string>('');

    useEffect(() => {
        if (fromDate && toDate) {
            setDiff({
                years: differenceInYears(toDate, fromDate),
                months: differenceInMonths(toDate, fromDate),
                weeks: differenceInWeeks(toDate, fromDate),
                days: differenceInDays(toDate, fromDate),
            });
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        if (calcDate) {
            const value = parseInt(addValue, 10);
            if (isNaN(value)) return;
            let newDate;
            if (addUnit === 'days') newDate = addDays(calcDate, value);
            else if (addUnit === 'months') newDate = addMonths(calcDate, value);
            else newDate = addYears(calcDate, value);
            setResultDate(format(newDate, 'PPP'));
        }
    }, [calcDate, addValue, addUnit]);

    return (
         <div className="p-4 space-y-6">
            <Card>
                <CardContent className="p-4 space-y-3">
                     <h3 className="text-sm font-semibold">Calculate Difference</h3>
                     <div className="flex items-center gap-2">
                        <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full h-8 text-xs"><CalendarIcon className="mr-2 h-4 w-4"/>{fromDate ? format(fromDate, "PPP") : "Start Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent></Popover>
                        <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full h-8 text-xs"><CalendarIcon className="mr-2 h-4 w-4"/>{toDate ? format(toDate, "PPP") : "End Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent></Popover>
                    </div>
                     <div className="grid grid-cols-2 gap-2 text-center text-sm">
                        <div className="p-2 bg-muted/50 rounded-lg"><p className="font-bold">{diff.days}</p><p className="text-xs text-muted-foreground">Days</p></div>
                        <div className="p-2 bg-muted/50 rounded-lg"><p className="font-bold">{diff.weeks}</p><p className="text-xs text-muted-foreground">Weeks</p></div>
                        <div className="p-2 bg-muted/50 rounded-lg"><p className="font-bold">{diff.months}</p><p className="text-xs text-muted-foreground">Months</p></div>
                        <div className="p-2 bg-muted/50 rounded-lg"><p className="font-bold">{diff.years}</p><p className="text-xs text-muted-foreground">Years</p></div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                 <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Add/Subtract from Date</h3>
                     <div className="space-y-1"><Label className="text-xs">Start Date</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full h-8 text-xs"><CalendarIcon className="mr-2 h-4 w-4"/>{calcDate ? format(calcDate, "PPP") : "Select Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={calcDate} onSelect={setCalcDate} initialFocus /></PopoverContent></Popover></div>
                     <div className="flex items-center gap-2">
                        <Input type="number" value={addValue} onChange={(e) => setAddValue(e.target.value)} className="h-8 text-sm" />
                        <Select value={addUnit} onValueChange={(v) => setAddUnit(v as any)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="days">Days</SelectItem><SelectItem value="months">Months</SelectItem><SelectItem value="years">Years</SelectItem></SelectContent></Select>
                    </div>
                    <div className="pt-2"><p className="text-sm">Result: <span className="font-bold">{resultDate}</span></p></div>
                </CardContent>
            </Card>
        </div>
    )
};

const InterestCalculator = () => {
    const [principal, setPrincipal] = useState('10000');
    const [rate, setRate] = useState('5');
    const [time, setTime] = useState('2');
    const [timeUnit, setTimeUnit] = useState<'years' | 'months' | 'days'>('years');
    const [compoundFrequency, setCompoundFrequency] = useState(1);
    const [interestType, setInterestType] = useState('simple');
    const [result, setResult] = useState({ interest: '0', total: '0' });

    useEffect(() => {
        const p = parseFloat(principal);
        const r = parseFloat(rate) / 100;
        let t = parseFloat(time);

        if (isNaN(p) || isNaN(r) || isNaN(t)) return;
        
        if (timeUnit === 'months') t = t / 12;
        if (timeUnit === 'days') t = t / 365;

        if (interestType === 'simple') {
            const interest = p * r * t;
            const total = p + interest;
            setResult({ interest: interest.toFixed(2), total: total.toFixed(2) });
        } else { // compound
            const n = compoundFrequency;
            const total = p * Math.pow(1 + r / n, n * t);
            const interest = total - p;
            setResult({ interest: interest.toFixed(2), total: total.toFixed(2) });
        }
    }, [principal, rate, time, timeUnit, compoundFrequency, interestType]);


    return (
        <div className="p-4 space-y-4">
             <Select value={interestType} onValueChange={setInterestType}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="simple">Simple Interest</SelectItem><SelectItem value="compound">Compound Interest</SelectItem></SelectContent>
            </Select>
            <div className="space-y-1"><Label>Principal Amount</Label><Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="h-8" /></div>
            <div className="space-y-1"><Label>Annual Interest Rate (%)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-8" /></div>
            <div className="flex gap-2">
                <div className="flex-1 space-y-1"><Label>Time</Label><Input type="number" value={time} onChange={(e) => setTime(e.target.value)} className="h-8"/></div>
                <div className="flex-1 space-y-1"><Label>Unit</Label><Select value={timeUnit} onValueChange={(v) => setTimeUnit(v as any)}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="years">Years</SelectItem><SelectItem value="months">Months</SelectItem><SelectItem value="days">Days</SelectItem></SelectContent></Select></div>
            </div>
            {interestType === 'compound' && (<div className="space-y-1"><Label>Compound Frequency</Label><Select value={String(compoundFrequency)} onValueChange={(v) => setCompoundFrequency(Number(v))}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">Annually</SelectItem><SelectItem value="2">Semi-Annually</SelectItem><SelectItem value="4">Quarterly</SelectItem><SelectItem value="12">Monthly</SelectItem></SelectContent></Select></div>)}
            <Card className="bg-muted/50 p-4 space-y-2 mt-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Interest:</span><span className="font-semibold">{formatCurrency(parseFloat(result.interest))}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span className="text-foreground">Total Amount:</span><span className="text-primary">{formatCurrency(parseFloat(result.total))}</span></div>
            </Card>
        </div>
    );
};

const PercentageCalculator = () => {
    const [calcType, setCalcType] = useState('percentOf');
    const [valueA, setValueA] = useState('');
    const [valueB, setValueB] = useState('');
    const [result, setResult] = useState<string | null>(null);

    useEffect(() => {
        const numA = parseFloat(valueA);
        const numB = parseFloat(valueB);

        if (isNaN(numA) || isNaN(numB)) {
            setResult(null);
            return;
        }

        let res = 0;
        if (calcType === 'percentOf') {
            res = (numA / 100) * numB;
            setResult(res.toLocaleString());
        } else if (calcType === 'isWhatPercent') {
            if (numB === 0) { setResult('N/A'); return; }
            res = (numA / numB) * 100;
            setResult(`${res.toFixed(2)}%`);
        } else if (calcType === 'percentChange') {
            if (numA === 0) { setResult('N/A'); return; }
            res = ((numB - numA) / numA) * 100;
            const changeType = res > 0 ? 'increase' : 'decrease';
            setResult(`${Math.abs(res).toFixed(2)}% ${changeType}`);
        }
    }, [valueA, valueB, calcType]);
    
    const getLabels = () => {
        switch(calcType) {
            case 'percentOf': return { labelA: 'Percentage (%)', labelB: 'Of Number' };
            case 'isWhatPercent': return { labelA: 'Value (x)', labelB: 'Is what % of (y)' };
            case 'percentChange': return { labelA: 'From (Old Value)', labelB: 'To (New Value)' };
            default: return { labelA: 'Value A', labelB: 'Value B' };
        }
    }

    return (
        <div className="p-4 space-y-4">
            <Select value={calcType} onValueChange={setCalcType}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="percentOf">What is x% of y?</SelectItem>
                    <SelectItem value="isWhatPercent">x is what % of y?</SelectItem>
                    <SelectItem value="percentChange">% change from x to y</SelectItem>
                </SelectContent>
            </Select>
             <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label>{getLabels().labelA}</Label>
                    <Input type="number" value={valueA} onChange={(e) => setValueA(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1">
                    <Label>{getLabels().labelB}</Label>
                    <Input type="number" value={valueB} onChange={(e) => setValueB(e.target.value)} className="h-8" />
                </div>
            </div>
             <Card className="bg-muted/50 p-4 mt-4 h-20 flex items-center justify-center">
                {result !== null ? (
                    <p className="text-2xl font-bold text-primary">{result}</p>
                ) : (
                    <p className="text-sm text-muted-foreground">Result will appear here</p>
                )}
            </Card>
        </div>
    );
};


export const AdvancedCalculator = () => {
    return (
        <Card className="shadow-none rounded-2xl">
            <CardContent className="p-0">
                <Tabs defaultValue="calculator" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 h-9">
                        <TabsTrigger value="calculator" className="h-full">Scientific</TabsTrigger>
                        <TabsTrigger value="converter" className="h-full">Converter</TabsTrigger>
                        <TabsTrigger value="gst" className="h-full">GST</TabsTrigger>
                        <TabsTrigger value="percentage" className="h-full">Percentage</TabsTrigger>
                        <TabsTrigger value="date" className="h-full">Date</TabsTrigger>
                        <TabsTrigger value="interest" className="h-full">Interest</TabsTrigger>
                    </TabsList>
                    <TabsContent value="calculator">
                        <ScientificCalculator />
                    </TabsContent>
                    <TabsContent value="converter">
                        <UnitConverter />
                    </TabsContent>
                    <TabsContent value="gst">
                        <GSTCalculator />
                    </TabsContent>
                    <TabsContent value="percentage">
                        <PercentageCalculator />
                    </TabsContent>
                    <TabsContent value="date">
                        <DateCalculator />
                    </TabsContent>
                     <TabsContent value="interest">
                        <InterestCalculator />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
