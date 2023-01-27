import { importProvidersFrom, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Route } from '@angular/router';
import { authGuard, hasJournalGuard, dashboardGuard, journalGuard, loginGuard, registerGuard, createProfileGuard } from '@core/guards';
import { fileListStateFactory, FILE_LIST_RX_STATE } from '@features/file-list';
import { InvitesService } from '@features/invites/services/invites.service';
import { RegisterService } from '@features/register/services/register.service';
import { CanistersService } from '@features/canisters/services';
import { WalletService } from '@features/wallet/services';
import { SidebarService } from './layout/dashboard/services/sidebar.service';
import { BucketsService } from '@core/services';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./layout/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard],
        children: [
            {
                path: 'drive',
                canActivateChild: [journalGuard],
                children: [
                    { path: '', loadComponent: () => import('./features/file-list/file-list.component').then(m => m.FileListComponent) },
                    { path: '**', loadComponent: () => import('./features/file-list/file-list.component').then(m => m.FileListComponent) }
                ]
            },
            { path: 'invites', loadComponent: () => import('./features/invites/invites.component').then(m => m.InvitesComponent), providers: [InvitesService] },
            { path: 'account', loadComponent: () => import('./features/wallet/wallet.component').then(m => m.WalletComponent) },
            { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
            {
                path: 'canisters',
                loadComponent: () => import('./features/canisters/canisters.component').then(m => m.CanistersComponent),
                providers: [CanistersService]
            },
            {
                path: '',
                loadComponent: () => import('./layout/dashboard/components/sidebar-content/sidebar-content.component').then(m => m.SidebarContentComponent),
                outlet: 'sidebar'
            },
            // { path: 'profile', loadChildren: () => import('./features/profile/profile.module').then(m => m.ProfileModule) },
            { path: '', redirectTo: 'drive', pathMatch: 'full' }
        ],
        providers: [
            BucketsService,
            { provide: FILE_LIST_RX_STATE, useFactory: fileListStateFactory, deps: [BucketsService] },
            SidebarService,
            WalletService
            // SnackbarProgressService
        ]
    },
    // {
    //     path: '',
    //     loadComponent: () => import('./upload/upload.component').then(m => m.UploadComponent),
    //     providers: [
    //         {
    //             provide: FILE_LIST_ICONS_CONFIG,
    //             useValue: GRAY_ICONS_CONFIG
    //         }
    //     ]
    // },
    {
        path: 'register',
        loadComponent: () => import('./layout/dashboard/dashboard.component').then(m => m.DashboardComponent),
        providers: [SidebarService, RegisterService, BucketsService],
        canActivate: [authGuard],
        children: [
            { path: '', canMatch: [createProfileGuard], loadComponent: () => import('./features/register/components/profile/profile.component').then(m => m.ProfileComponent) },
            { path: '', canActivate: [registerGuard], loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
            {
                path: '',
                loadComponent: () => import('./features/register/components/sidebar-content/sidebar-content.component').then(m => m.SidebarContentComponent),
                outlet: 'sidebar'
            }
        ]
    },
    {
        path: 'login',
        loadComponent: () => import('./layout/login/login.component').then(m => m.LoginComponent),
        canActivate: [loginGuard]
    },
    { path: '**', redirectTo: '' }
];
