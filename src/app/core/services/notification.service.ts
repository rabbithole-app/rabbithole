import { inject, Injectable, NgZone } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable()
export class NotificationService {
    private snackBar = inject(MatSnackBar);
    private zone = inject(NgZone);

    default(message: string) {
        this.show(message, { duration: 2000 });
    }

    info(message: string) {
        this.show(message, { duration: 2000 });
    }

    success(message: string) {
        this.show(message, { duration: 2000 });
    }

    warn(message: string) {
        this.show(message, { duration: 2500 });
    }

    error(message: string) {
        this.show(message, { duration: 3000 });
    }

    private show(message: string, configuration: MatSnackBarConfig) {
        // Need to open snackBar from Angular zone to prevent issues with its position per
        // https://stackoverflow.com/questions/50101912/snackbar-position-wrong-when-use-errorhandler-in-angular-5-and-material
        this.zone.run(() => this.snackBar.open(message, undefined, configuration));
    }
}
