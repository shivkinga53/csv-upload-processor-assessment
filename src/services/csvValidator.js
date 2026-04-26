export const validateRow = (row) => {
    const requiredColumns = ['date', 'description', 'amount', 'category'];
    const missingColumns = requiredColumns.filter(col => !row[col] || row[col].trim() === '');

    if (missingColumns.length > 0) {
        return { 
            valid: false, 
            reason: `Missing required columns: ${missingColumns.join(', ')}` 
        };
    }

    const amountStr = row.amount.replace(/,/g, ''); 
    if (isNaN(Number(amountStr))) {
        return { 
            valid: false, 
            reason: `Amount is not a valid number: ${row.amount}` 
        };
    }

    return { valid: true };
};