import { sanitizeString, sanitizeObject } from '../sanitize-input';

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    const input = '<script>alert("xss")</script>Hello <b>World</b>';
    const result = sanitizeString(input);
    expect(result).toBe('alert("xss")Hello World');
  });

  it('should trim whitespace', () => {
    const input = '  hello world  ';
    const result = sanitizeString(input);
    expect(result).toBe('hello world');
  });

  it('should handle empty string', () => {
    const input = '';
    const result = sanitizeString(input);
    expect(result).toBe('');
  });
});

describe('sanitizeObject', () => {
  it('should sanitize string properties in an object', () => {
    const input = {
      name: '  <b>John</b>  ',
      age: 30,
      bio: '<script>bad</script>'
    };
    const result = sanitizeObject(input);
    expect(result).toEqual({
      name: 'John',
      age: 30,
      bio: 'bad'
    });
  });

  it('should sanitize nested objects', () => {
    const input = {
      user: {
        name: '  Alice  ',
        details: {
          note: '<i>Hi</i>'
        }
      }
    };
    const result = sanitizeObject(input);
    expect(result).toEqual({
      user: {
        name: 'Alice',
        details: {
          note: 'Hi'
        }
      }
    });
  });

  it('should sanitize arrays', () => {
    const input = ['  a  ', '<b>b</b>'];
    const result = sanitizeObject(input);
    expect(result).toEqual(['a', 'b']);
  });
});
