export const formatNumber = (value: number, options?: { minFraction: number; maxFraction: number }): string => {
    const { minFraction = 2, maxFraction = 2 } = options || {};

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: minFraction,
        maximumFractionDigits: maxFraction
    })
        .format(value)
        .replace(/\s/g, '’')
        .replace(',', '.');
};
