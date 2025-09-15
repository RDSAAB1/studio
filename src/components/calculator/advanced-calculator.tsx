
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const CalculatorButton = ({ onClick, children, className }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <Button variant="outline" className={`h-14 text-xl ${className}`} onClick={onClick}>{children}</Button>
);

const Calculator = () => {
    const [input, setInput] = useState('0');
    const [previousInput, setPreviousInput] = useState<string | null>(null);
    const [operator, setOperator] = useState<string | null>(null);

    const handleNumber = (num: string) => {
        setInput(prev => (prev === '0' && num !== '.') ? num : prev + num);
    };

    const handleOperator = (op: string) => {
        if (operator && previousInput) {
            handleEquals();
            setOperator(op);
        } else {
            setPreviousInput(input);
            setInput('0');
            setOperator(op);
        }
    };
    
    const handleEquals = () => {
        if (!operator || previousInput === null) return;
        const prev = parseFloat(previousInput);
        const curr = parseFloat(input);
        let result;
        switch (operator) {
            case '+': result = prev + curr; break;
            case '-': result = prev - curr; break;
            case '×': result = prev * curr; break;
            case '÷': result = prev / curr; break;
            default: return;
        }
        setInput(String(result));
        setPreviousInput(null);
        setOperator(null);
    };

    const handleClear = () => {
        setInput('0');
        setPreviousInput(null);
        setOperator(null);
    };
    
    const handleBackspace = () => {
        setInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    }

    return (
        <div className="p-4 space-y-4">
            <Input type="text" readOnly value={input} className="h-20 text-4xl text-right font-mono" />
            <div className="grid grid-cols-4 gap-2">
                <CalculatorButton onClick={handleClear} className="col-span-2 bg-destructive/80 text-destructive-foreground">AC</CalculatorButton>
                <CalculatorButton onClick={handleBackspace}>⌫</CalculatorButton>
                <CalculatorButton onClick={() => handleOperator('÷')}>÷</CalculatorButton>
                
                {['7', '8', '9'].map(n => <CalculatorButton key={n} onClick={() => handleNumber(n)}>{n}</CalculatorButton>)}
                <CalculatorButton onClick={() => handleOperator('×')}>×</CalculatorButton>

                {['4', '5', '6'].map(n => <CalculatorButton key={n} onClick={() => handleNumber(n)}>{n}</CalculatorButton>)}
                <CalculatorButton onClick={() => handleOperator('-')}>-</CalculatorButton>

                {['1', '2', '3'].map(n => <CalculatorButton key={n} onClick={() => handleNumber(n)}>{n}</CalculatorButton>)}
                <CalculatorButton onClick={() => handleOperator('+')}>+</CalculatorButton>

                <CalculatorButton onClick={() => handleNumber('0')} className="col-span-2">0</CalculatorButton>
                <CalculatorButton onClick={() => handleNumber('.')}>.</CalculatorButton>
                <CalculatorButton onClick={handleEquals} className="bg-primary text-primary-foreground">=</CalculatorButton>
            </div>
        </div>
    );
};

const unitConfig = {
    Weight: {
        Kilogram: 1,
        Quintal: 100,
        Tonne: 1000,
    },
    Length: {
        Meter: 1,
        Kilometer: 1000,
        Centimeter: 0.01,
        Millimeter: 0.001,
    }
};

const UnitConverter = () => {
    const [category, setCategory] = useState<keyof typeof unitConfig>('Weight');
    const [fromUnit, setFromUnit] = useState('Kilogram');
    const [toUnit, setToUnit] = useState('Quintal');
    const [fromValue, setFromValue] = useState('1');
    const [toValue, setToValue] = useState('');

    const convert = () => {
        const fromFactor = unitConfig[category][fromUnit as keyof typeof unitConfig.Weight | keyof typeof unitConfig.Length];
        const toFactor = unitConfig[category][toUnit as keyof typeof unitConfig.Weight | keyof typeof unitConfig.Length];
        const result = (parseFloat(fromValue) * fromFactor) / toFactor;
        setToValue(result.toString());
    };

    useState(() => {
       convert();
    });
    
    useEffect(() => {
        const units = Object.keys(unitConfig[category]);
        setFromUnit(units[0]);
        setToUnit(units[1]);
        setFromValue('1');
    }, [category]);
    
    useEffect(() => {
        convert();
    }, [fromValue, fromUnit, toUnit, category]);

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

export const AdvancedCalculator = () => {
    return (
        <Card className="border-0 shadow-none rounded-2xl">
            <CardContent className="p-0">
                <Tabs defaultValue="calculator" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="calculator">Calculator</TabsTrigger>
                        <TabsTrigger value="converter">Unit Converter</TabsTrigger>
                    </TabsList>
                    <TabsContent value="calculator">
                        <Calculator />
                    </TabsContent>
                    <TabsContent value="converter">
                        <UnitConverter />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
