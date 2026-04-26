export const validateRow = (row) => {
    const errors = [];

    const requiredColumns = ['date', 'description', 'amount'];
    const missingColumns = requiredColumns.filter(col => !row[col] || String(row[col]).trim() === '');

    if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
        return { valid: false, reason: errors.join(' | ') };
    }

    let cleanAmountStr = String(row.amount).replace(/−/g, '-').replace(/,/g, '').trim();
    const amountNum = Number(cleanAmountStr);
    if (isNaN(amountNum)) errors.push(`Amount must be a valid number`);

    const parsedDate = new Date(row.date);
    if (isNaN(parsedDate.getTime())) errors.push(`Invalid date format`);
    if (String(row.description).trim().length === 0) errors.push(`Description cannot be empty`);
    if (errors.length > 0) return { valid: false, reason: errors.join(' | ') };

    return {
        valid: true,
        cleanData: {
            date: parsedDate.toISOString().split('T')[0],
            description: String(row.description).trim(),
            amount: amountNum,
            category: row.category ? String(row.category).trim() : 'Uncategorized'
        }
    };
};