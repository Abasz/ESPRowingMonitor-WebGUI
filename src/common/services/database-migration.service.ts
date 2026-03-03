import { Injectable, signal, WritableSignal } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

import { MigrationOverlayComponent } from "../../app/migration-update-dialog/migration-dialog.component";
import { IMigrationProgress } from "../common.interfaces";
import { AppDB, appDB } from "../utils/app-database";

@Injectable({
    providedIn: "root",
})
export class DatabaseMigrationService {
    private readonly migrationProgress: WritableSignal<IMigrationProgress> = signal({
        processed: 0,
        total: 0,
        startedAt: 0,
    });

    constructor(private dialog: MatDialog) {}

    /**
     * Checks whether the database needs migration and shows a blocking dialog if so, and opens the database (triggering Dexie migrations).
     */
    async initialize(): Promise<void> {
        const isMigrationRequired: boolean = await this.checkNeedsMigration();

        let dialogRef: MatDialogRef<MigrationOverlayComponent> | undefined;

        if (isMigrationRequired) {
            this.migrationProgress.set({ processed: 0, total: 0, startedAt: 0 });
            dialogRef = this.dialog.open(MigrationOverlayComponent, {
                disableClose: true,
                data: this.migrationProgress.asReadonly(),
            });

            appDB.setUpgradeProgressCallback((processed: number, total: number): void => {
                const current = this.migrationProgress();
                this.migrationProgress.set({
                    processed,
                    total,
                    startedAt: processed > 0 && current.startedAt === 0 ? Date.now() : current.startedAt,
                });
            });
        }

        try {
            await appDB.open();
        } finally {
            appDB.setUpgradeProgressCallback(undefined);
            dialogRef?.close();
        }
    }

    /**
     * Checks the native IndexedDB version to determine whether a Dexie schema migration will be needed when the database is opened.
     */
    private async checkNeedsMigration(): Promise<boolean> {
        const databases: Array<IDBDatabaseInfo> = await globalThis.indexedDB.databases();
        const ourDB = databases.find((db: IDBDatabaseInfo): boolean => db.name === "ESPRowingMonitorDB");

        if (ourDB === undefined || ourDB.version === undefined) {
            // fresh install — no old data to migrate.
            return false;
        }

        // note: Dexie stores its schema version as `dexieVersion * 10` in IndexedDB.
        return ourDB.version < AppDB.dbVersion * 10;
    }
}
