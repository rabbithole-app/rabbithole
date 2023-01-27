import { MatDateFormats } from '@angular/material/core';

export const DATE_FORMATS: MatDateFormats = {
    parse: {
        dateInput: 'dd/MM/yyyy'
    },
    display: {
        dateInput: 'dd/MM/yyyy',
        monthYearLabel: 'MMM yyyy',
        dateA11yLabel: 'LL',
        monthYearA11yLabel: 'MMMM yyyy'
    }
};
