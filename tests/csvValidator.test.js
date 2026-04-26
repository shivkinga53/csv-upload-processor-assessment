import { validateRow } from '../src/services/csvValidator.js';

describe('CSV Row Validation Permutations', () => {
    it('should pass a perfectly formatted row', () => {
        const row = { date: '2024-04-26', description: 'Office Supplies', amount: '150.00', category: 'Work' };
        const result = validateRow(row);
        expect(result.valid).toBe(true);
        expect(result.cleanData.amount).toBe(150.00);
    });

    it('should clean commas and unicode minus signs from amounts', () => {
        const row = { date: '2024-04-26', description: 'Dinner', amount: '−1,250.75', category: 'Food' };
        const result = validateRow(row);
        expect(result.valid).toBe(true);
        expect(result.cleanData.amount).toBe(-1250.75);
    });

    it('should handle amounts with currency symbols', () => {
        const row = { date: '2024-04-26', description: 'Refund', amount: '$500', category: 'Misc' };
        const result = validateRow(row);
        expect(result.valid).toBe(true);
        expect(result.cleanData.amount).toBe(500);
    });

    it('should reject if date is missing', () => {
        const row = { date: '', description: 'Test', amount: '10', category: 'X' };
        const result = validateRow(row);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Missing required columns: date');
    });

    it('should reject if description is only whitespace', () => {
        const row = { date: '2024-04-26', description: '   ', amount: '10', category: 'X' };
        const result = validateRow(row);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Missing required columns: description');
    });

    it('should reject if amount is not a number', () => {
        const row = { date: '2024-04-26', description: 'Test', amount: 'abc', category: 'X' };
        const result = validateRow(row);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Amount must be a valid number');
    });

    it('should reject if date is in an unparseable format', () => {
        const row = { date: 'invalid-date', description: 'Test', amount: '10', category: 'X' };
        const result = validateRow(row);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Invalid date format');
    });
});