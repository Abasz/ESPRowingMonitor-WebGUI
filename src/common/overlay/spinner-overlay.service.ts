import { GlobalPositionStrategy, Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { ComponentRef, Injectable, Injector } from "@angular/core";

import { SpinnerOverlayRef } from "./spinner-overlay-ref";
import { SpinnerOverlayComponent } from "./spinner-overlay.component";

@Injectable()
export class SpinnerOverlayService {
    private DEFAULT_CONFIG: OverlayConfig = {
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
    };

    constructor(private overlay: Overlay) {}

    open(config: OverlayConfig = {}): SpinnerOverlayRef {
        const dialogConfig: OverlayConfig = {
            ...this.DEFAULT_CONFIG,
            ...config,
        };

        const overlayRef: OverlayRef = this.createOverlay(dialogConfig);

        const dialogRef: SpinnerOverlayRef = new SpinnerOverlayRef(overlayRef);

        const overlayComponent: SpinnerOverlayComponent = this.attachDialogContainer(overlayRef, dialogRef);

        dialogRef.componentInstance = overlayComponent;

        return dialogRef;
    }

    private attachDialogContainer(
        overlayRef: OverlayRef,
        dialogRef: SpinnerOverlayRef,
    ): SpinnerOverlayComponent {
        const injector: Injector = Injector.create({
            providers: [{ provide: SpinnerOverlayRef, useValue: dialogRef }],
        });

        const containerPortal: ComponentPortal<SpinnerOverlayComponent> = new ComponentPortal(
            SpinnerOverlayComponent,
            undefined,
            injector,
        );
        const containerRef: ComponentRef<SpinnerOverlayComponent> = overlayRef.attach(containerPortal);

        return containerRef.instance;
    }

    private createOverlay(config: OverlayConfig): OverlayRef {
        const overlayConfig: OverlayConfig = this.getOverlayConfig(config);

        return this.overlay.create(overlayConfig);
    }

    private getOverlayConfig(config: OverlayConfig): OverlayConfig {
        const positionStrategy: GlobalPositionStrategy = this.overlay
            .position()
            .global()
            .centerHorizontally()
            .centerVertically();

        const overlayConfig: OverlayConfig = new OverlayConfig({
            hasBackdrop: config.hasBackdrop,
            backdropClass: config.backdropClass,
            panelClass: config.panelClass,
            scrollStrategy: this.overlay.scrollStrategies.block(),
            positionStrategy,
        });

        return overlayConfig;
    }
}
