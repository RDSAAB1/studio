
"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const CalculatorButton = ({ onClick, children, className }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <Button variant="outline" className={`h-12 text-lg ${className}`} onClick={onClick}>{children}</Button>
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

    const handleEquals = () => {
        try {
            // Replace math symbols for evaluation
            let evalString = input
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/π/g, 'Math.PI')
                .replace(/e/g, 'Math.E');

            // This is a simplified evaluation and has security risks if used with arbitrary user input.
            // For this controlled environment, it's acceptable.
            const result = new Function('return ' + evalString)();
            
            if (isNaN(result) || !isFinite(result)) {
                setInput('Error');
            } else {
                setInput(String(result));
            }
            setIsResult(true);
        } catch (error) {
            setInput('Error');
            setIsResult(true);
        }
    };
    
    const handleFunction = (func: string) => {
        setIsResult(false);
        if (func === '√') {
            setInput(prev => `Math.sqrt(${prev})`);
        } else if (func === 'x²') {
            setInput(prev => `Math.pow(${prev}, 2)`);
        } else if (func === 'x³') {
            setInput(prev => `Math.pow(${prev}, 3)`);
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
        } else {
            setInput(prev => `Math.${func}(${prev})`);
        }
    }


    return (
        <div className="p-4 space-y-2">
            <Input type="text" readOnly value={input} className="h-20 text-3xl text-right font-mono" />
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
                <CalculatorButton onClick={() => handleInput('.')}>.</CalculatorButton>
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
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        {Object.keys(unitConfig).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                 <div className="flex-1 space-y-1">
                    <Label>From</Label>
                    <Input type="number" value={fromValue} onChange={(e) => setFromValue(e.target.value)} />
                    <Select value={fromUnit} onValueChange={setFromUnit}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {units.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex-1 space-y-1">
                    <Label>To</Label>
                    <Input type="text" readOnly value={toValue} />
                    <Select value={toUnit} onValueChange={setToUnit}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
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
                <Input id="gst-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
                <Label htmlFor="gst-rate">GST Rate (%)</Label>
                <Input id="gst-rate" type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Calculation Type</Label>
                <Select value={calculationType} onValueChange={(v) => setCalculationType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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


export const AdvancedCalculator = () => {
    return (
        <Card className="border-0 shadow-none rounded-2xl">
            <CardContent className="p-0">
                <Tabs defaultValue="calculator" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="calculator">Scientific</TabsTrigger>
                        <TabsTrigger value="converter">Unit Converter</TabsTrigger>
                        <TabsTrigger value="gst">GST</TabsTrigger>
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
                </Tabs>
            </CardContent>
        </Card>
    );
};
