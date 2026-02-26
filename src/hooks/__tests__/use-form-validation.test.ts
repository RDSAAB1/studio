import { renderHook } from '@testing-library/react';
import { useFormValidation } from '../use-form-validation';
import { z } from 'zod';

describe('useFormValidation', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(18, 'Must be 18'),
  });

  it('should initialize form with resolver', () => {
    const { result } = renderHook(() => useFormValidation(schema));
    
    expect(result.current.register).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.formState).toBeDefined();
  });

  it('should accept default values', () => {
    const defaultValues = { name: 'John', age: 25 };
    const { result } = renderHook(() => useFormValidation(schema, { defaultValues }));
    
    expect(result.current.getValues()).toEqual(defaultValues);
  });
});
