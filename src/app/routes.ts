import { importProvidersFrom } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { Route } from '@angular/router';

import { authGuard, createProfileGuard, dashboardGuard, invitationsGuard, journalGuard, loginGuard, registerGuard } from '@core/guards';
import { CanistersService } from '@features/canisters/services';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { GRAY_ICONS_CONFIG } from '@features/file-list/config/icons';
import { fileListResolver } from '@features/file-list/resolvers/file-list.resolver';
import { JournalService, SnackbarProgressService } from '@features/file-list/services';
import { FileListService } from '@features/file-list/services/file-list.service';
import { InvitationsService } from '@features/invitations/services/invitations.service';
import { RegisterService } from '@features/register/services/register.service';
import { UploadService } from '@features/upload/services';
import { WalletService } from '@features/wallet/services';
import { SidebarService } from './layout/dashboard/services/sidebar.service';

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
                title: 'navigation.my-files',
                data: { title: 'navigation.my-files' },
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
                path: 'shared',
                canActivateChild: [journalGuard],
                title: 'navigation.shared',
                data: { title: 'navigation.shared' },
                loadComponent: () => import('./features/shared-with-me/shared-with-me.component').then(m => m.SharedWithMeComponent)
            },
            {
                path: 'invitations',
                loadComponent: () => import('./features/invitations/invitations.component').then(m => m.InvitationsComponent),
                providers: [InvitationsService],
                canActivate: [invitationsGuard]
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
            { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
            { path: '', redirectTo: 'drive', pathMatch: 'full' }
        ],
        providers: [
            FileListService,
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
        providers: [SidebarService, RegisterService],
        canActivate: [authGuard],
        children: [
            {
                path: '',
                canMatch: [createProfileGuard],
                loadComponent: () => import('./features/register/components/create-profile/create-profile.component').then(m => m.CreateProfileComponent),
                providers: [UploadService, FileListService, JournalService, SnackbarProgressService, importProvidersFrom(MatDialogModule)]
            },
            {
                path: '',
                canActivate: [registerGuard],
                loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent)
            }
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
