import { Route } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

import { authGuard, journalGuard, loginGuard, registerGuard, createProfileGuard, dashboardGuard } from '@core/guards';
import { fileListStateFactory, FILE_LIST_RX_STATE } from '@features/file-list';
import { InvitationsService } from '@features/invitations/services/invitations.service';
import { RegisterService } from '@features/register/services/register.service';
import { CanistersService } from '@features/canisters/services';
import { WalletService } from '@features/wallet/services';
import { SidebarService } from './layout/dashboard/services/sidebar.service';
import { BucketsService } from '@core/services';
import { fileListResolver } from '@features/file-list/resolvers/file-list.resolver';
import { JournalService, SnackbarProgressService } from '@features/file-list/services';
import { UploadService } from '@features/upload/services';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { GRAY_ICONS_CONFIG } from '@features/file-list/config/icons';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./layout/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard],
        canActivateChild: [dashboardGuard],
        children: [
            {
                path: 'drive',
                canActivateChild: [journalGuard],
                children: [
                    {
                        path: '',
                        resolve: { fileList: fileListResolver },
                        loadComponent: () => import('./features/file-list/file-list.component').then(m => m.FileListComponent)
                    },
                    {
                        path: '**',
                        resolve: { fileList: fileListResolver },
                        loadComponent: () => import('./features/file-list/file-list.component').then(m => m.FileListComponent)
                    }
                ]
            },
            {
                path: 'invitations',
                loadComponent: () => import('./features/invitations/invitations.component').then(m => m.InvitationsComponent),
                providers: [InvitationsService]
            },
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
            {
                path: '',
                loadComponent: () => import('./features/upload/upload.component').then(m => m.UploadComponent),
                outlet: 'sidebar-right'
            },
            {
                path: '',
                loadComponent: () => import('./layout/dashboard/components/user-menu/user-menu.component').then(m => m.UserMenuComponent),
                outlet: 'header'
            },
            // { path: 'profile', loadChildren: () => import('./features/profile/profile.module').then(m => m.ProfileModule) },
            { path: '', redirectTo: 'drive', pathMatch: 'full' }
        ],
        providers: [
            BucketsService,
            { provide: FILE_LIST_RX_STATE, useFactory: fileListStateFactory, deps: [BucketsService] },
            SidebarService,
            WalletService,
            UploadService,
            JournalService,
            SnackbarProgressService,
            importProvidersFrom(MatDialogModule),
            {
                provide: FILE_LIST_ICONS_CONFIG,
                useValue: GRAY_ICONS_CONFIG
            }
        ]
    },
    {
        path: 'register',
        loadComponent: () => import('./layout/dashboard/dashboard.component').then(m => m.DashboardComponent),
        providers: [SidebarService, RegisterService, BucketsService],
        canActivate: [authGuard],
        children: [
            {
                path: '',
                canMatch: [createProfileGuard],
                loadComponent: () => import('./features/register/components/profile/profile.component').then(m => m.ProfileComponent)
            },
            { path: '', canActivate: [registerGuard], loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) }
            // {
            //     path: '',
            //     loadComponent: () => import('./features/register/components/sidebar-content/sidebar-content.component').then(m => m.SidebarContentComponent),
            //     outlet: 'sidebar'
            // }
        ]
    },
    {
        path: 'login',
        loadComponent: () => import('./layout/login/login.component').then(m => m.LoginComponent),
        canActivate: [loginGuard]
    },
    { path: '404', loadComponent: () => import('./core/components/not-found/not-found.component').then(m => m.NotFoundComponent) },
    { path: '**', redirectTo: '' }
];
