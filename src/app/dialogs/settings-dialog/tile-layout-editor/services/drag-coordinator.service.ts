import { Injectable, OnDestroy, Signal } from "@angular/core";

import { DragOverResult, DragStrategy, DropResult } from "../drag-strategies/drag-strategy";
import { MoveDragStrategy } from "../drag-strategies/move-drag-strategy.service";
import { PlaceDragStrategy } from "../drag-strategies/place-drag-strategy.service";
import { ResizeDragStrategy } from "../drag-strategies/resize-drag-strategy.service";
import { PointerEventData } from "../utils/pointer-event-data";
import { TileGridHelper } from "../utils/tile-grid.helper";
import {
    DragActionType,
    GridConfig,
    GridRect,
    PlacedTile,
    ResizeDirection,
    TileDefinition,
    TileDragSession,
    TilePosition,
} from "../utils/tile-layout.interfaces";
import { GestureMoveResult, TouchGestureRecognizer } from "../utils/touch-gesture-recognizer";

import { DndStateService, TileDragDropResult } from "./dnd-state.service";
import { DragPreviewRenderer } from "./drag-preview-renderer.service";
import { DragSessionManager } from "./drag-session-manager.service";
import { TileHighlightManager } from "./tile-highlight-manager.service";

interface PendingResizeTouchData {
    placedTile: PlacedTile;
    directions: Array<ResizeDirection>;
    tileEl: HTMLElement | null;
}

const GRID_TILE_BORDER_RADIUS = "6px";
const PALETTE_TILE_BORDER_RADIUS = "16px";

/**
 * Coordinates the entire drag lifecycle: drag start, drag-over preview,
 * drop placement, gesture recognition, document listener management,
 * and animation callbacks.
 *
 * The coordinator never owns tile state — it reads committed tiles from
 * the injected {@link DndStateService} and communicates drop results
 * back via `notifyDrop`. Preview state (swap visualization during drag) is
 * managed internally via `previewOverride`.
 */
@Injectable()
export class DragCoordinator implements OnDestroy {
    readonly isDropInvalid: Signal<boolean> = this.highlightManager.isDropInvalid.asReadonly();

    private readonly gestureRecognizer: TouchGestureRecognizer<PendingResizeTouchData> =
        new TouchGestureRecognizer<PendingResizeTouchData>();

    private _gridContainer: HTMLElement | undefined;
    private _paletteContainer: HTMLElement | undefined;

    private get gridContainer(): HTMLElement {
        if (!this._gridContainer) {
            throw new Error(
                "DragCoordinator: gridContainer not registered. Call registerGridContainer() first.",
            );
        }

        return this._gridContainer;
    }

    private get paletteContainer(): HTMLElement {
        if (!this._paletteContainer) {
            throw new Error(
                "DragCoordinator: paletteContainer not registered. Call registerPaletteContainer() first.",
            );
        }

        return this._paletteContainer;
    }

    private mouseMoveHandler: ((event: MouseEvent) => void) | undefined;
    private mouseUpHandler: ((event: MouseEvent) => void) | undefined;
    private touchMoveHandler: ((event: TouchEvent) => void) | undefined;
    private touchEndHandler: ((event: TouchEvent) => void) | undefined;
    private cachedGridConfig: GridConfig | undefined;

    private readonly strategyMap: Map<DragActionType, DragStrategy>;

    constructor(
        private readonly sessionManager: DragSessionManager,
        private readonly dragPreview: DragPreviewRenderer,
        private readonly highlightManager: TileHighlightManager,
        private readonly dndState: DndStateService,
        private readonly moveDragStrategy: MoveDragStrategy,
        private readonly placeDragStrategy: PlaceDragStrategy,
        private readonly resizeDragStrategy: ResizeDragStrategy,
    ) {
        this.strategyMap = new Map<DragActionType, DragStrategy>([
            ["move", this.moveDragStrategy],
            ["place", this.placeDragStrategy],
            ["resize", this.resizeDragStrategy],
        ]);
    }

    registerGridContainer(element: HTMLElement): void {
        this._gridContainer = element;
    }

    registerPaletteContainer(element: HTMLElement): void {
        this._paletteContainer = element;
    }

    startTileDrag(pointer: PointerEventData, placedTile: PlacedTile): void {
        let grabOffsetRow: number | undefined;
        let grabOffsetCol: number | undefined;
        let centerX: number | undefined;
        let centerY: number | undefined;

        if (pointer.sourceElement) {
            const grabOffset = TileGridHelper.calculateGrabOffset(
                pointer.sourceElement,
                pointer.clientX,
                pointer.clientY,
                placedTile.position,
            );
            grabOffsetRow = grabOffset.grabOffsetRow;
            grabOffsetCol = grabOffset.grabOffsetCol;

            const rect = pointer.sourceElement.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;

            this.dragPreview.create(
                pointer.sourceElement,
                pointer.clientX,
                pointer.clientY,
                GRID_TILE_BORDER_RADIUS,
                this.gridContainer,
            );
        }

        this.sessionManager.startMoveSession(placedTile, grabOffsetRow, grabOffsetCol, centerX, centerY);
    }

    startPaletteDrag(pointer: PointerEventData, tileDefinition: TileDefinition): void {
        let centerX: number | undefined;
        let centerY: number | undefined;

        if (pointer.sourceElement) {
            const rect = pointer.sourceElement.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;

            this.dragPreview.create(
                pointer.sourceElement,
                pointer.clientX,
                pointer.clientY,
                PALETTE_TILE_BORDER_RADIUS,
                this.paletteContainer,
            );
        }

        this.sessionManager.startPlaceSession(tileDefinition, centerX, centerY);
    }

    startResizeDrag(
        event: MouseEvent | TouchEvent,
        placedTile: PlacedTile,
        directions: Array<ResizeDirection>,
        handleElement: HTMLElement,
        inputType: "mouse" | "touch",
    ): void {
        const def = this.dndState.getDefinition(placedTile.id);
        const minRowSpan = def?.minRowSpan ?? 1;
        const minColumnSpan = def?.minColumnSpan ?? 1;

        if (inputType === "mouse") {
            this.sessionManager.startResizeSession(placedTile, directions, minRowSpan, minColumnSpan);
            this.registerMouseListeners();

            return;
        }

        const touch = (event as TouchEvent).touches[0];

        this.gestureRecognizer.startGesture(
            {
                placedTile,
                directions,
                tileEl: handleElement.closest("dnd-tile-drag") as HTMLElement | null,
            },
            { clientX: touch.clientX, clientY: touch.clientY },
            (): void => {
                this.sessionManager.startResizeSession(placedTile, directions, minRowSpan, minColumnSpan);
            },
        );

        this.registerTouchListeners();
    }

    registerListeners(inputType: "mouse" | "touch"): void {
        if (inputType === "mouse") {
            this.registerMouseListeners();

            return;
        }

        this.registerTouchListeners();
    }

    ngOnDestroy(): void {
        this.gestureRecognizer.cancelGesture();
        this.removeTouchListeners();
        this.removeMouseListeners();
        this.dndState.setPreviewOverride(undefined);
        this.highlightManager.clearAll();
        this.sessionManager.endSession();
        this.dragPreview.destroy();
    }

    private getStrategyForSession(session: TileDragSession): DragStrategy {
        const strategy = this.strategyMap.get(session.actionType);
        if (!strategy) {
            throw new Error(`Unknown session action type: ${session.actionType}`);
        }

        return strategy;
    }

    private handleDragOver(clientX: number, clientY: number): void {
        const session = this.sessionManager.dragSession();
        if (!session) {
            return;
        }

        this.dragPreview.move(clientX, clientY);

        const gridRect = this.gridContainer.getBoundingClientRect();

        if (!TileGridHelper.isPointInRect(clientX, clientY, gridRect)) {
            this.restorePreview();
            this.highlightManager.clearAll();

            return;
        }

        const strategy = this.getStrategyForSession(session);
        const baseTiles = this.getBaseTiles();
        const gridConfig = this.readGridConfig();
        const result: DragOverResult | undefined = strategy.handleDragOver(
            clientX,
            clientY,
            gridRect,
            session,
            baseTiles,
            gridConfig,
        );

        if (!result) {
            return;
        }

        this.highlightManager.updateHighlightsForPosition(result.highlightPosition);
        this.highlightManager.isDropInvalid.set(!result.isValid);

        if (!result.previewTiles) {
            this.restorePreview();

            return;
        }

        this.applySwapPreview(result.previewTiles);
    }

    private async handleDrop(clientX: number, clientY: number): Promise<void> {
        const session = this.sessionManager.dragSession();
        if (!session) {
            return;
        }

        const gridRect = this.gridContainer.getBoundingClientRect();

        if (TileGridHelper.isPointInRect(clientX, clientY, gridRect)) {
            await this.handleDropOnGrid(clientX, clientY, gridRect, session);

            return;
        }

        this.restorePreview();

        if (await this.tryDropOnPalette(clientX, clientY, session)) {
            return;
        }

        await this.animateReturnToOrigin(session, clientX, clientY);
    }

    private async handleDropOnGrid(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
    ): Promise<void> {
        const strategy = this.getStrategyForSession(session);
        const baseTiles = this.getBaseTiles();
        const gridConfig = this.readGridConfig();
        const result: DropResult | undefined = strategy.handleDrop(
            clientX,
            clientY,
            gridRect,
            session,
            baseTiles,
            gridConfig,
        );

        if (!result) {
            this.restorePreview();
            await this.animateReturnToOrigin(session, clientX, clientY);

            return;
        }

        const targetTile = result.tiles.find(
            (placedTile: PlacedTile): boolean => placedTile.id === session.id,
        );

        if (!targetTile) {
            this.completeDrop({ placedTiles: result.tiles });

            return;
        }

        const targetGeometry = this.getTileGeometry(targetTile.position);

        await this.dragPreview.animateToPosition(
            targetGeometry?.x ?? gridRect.left + gridRect.width / 2,
            targetGeometry?.y ?? gridRect.top + gridRect.height / 2,
            targetGeometry?.width,
            targetGeometry?.height,
            "grid",
        );

        this.completeDrop({
            placedTiles: result.tiles,
            placedFromPalette: session.actionType === "place" ? session.id : undefined,
        });
    }

    private async tryDropOnPalette(
        clientX: number,
        clientY: number,
        session: TileDragSession,
    ): Promise<boolean> {
        if (session.actionType !== "move") {
            return false;
        }

        const paletteRect = this.paletteContainer.getBoundingClientRect();
        if (!TileGridHelper.isPointInRect(clientX, clientY, paletteRect)) {
            return false;
        }

        const availableCount = this.paletteContainer.querySelectorAll("dnd-palette-drag").length;
        const paletteGeometry = this.readPaletteTargetGeometry(availableCount);
        const paletteTarget = paletteGeometry ?? {
            x: paletteRect.left + paletteRect.width - 50,
            y: paletteRect.top + paletteRect.height / 2,
        };

        await this.dragPreview.animateToPosition(
            paletteTarget.x,
            paletteTarget.y,
            paletteGeometry?.width,
            paletteGeometry?.height,
            "palette",
        );

        const remainingTiles = this.dndState
            .committedTiles()
            .filter((placedTile: PlacedTile): boolean => placedTile.id !== session.id);

        this.completeDrop({
            placedTiles: remainingTiles,
            movedToPalette: session.id,
        });

        return true;
    }

    private async animateReturnToOrigin(
        session: TileDragSession,
        clientX: number,
        clientY: number,
    ): Promise<void> {
        const returnX = session.startX ?? clientX;
        const returnY = session.startY ?? clientY;

        await this.dragPreview.animateToPosition(returnX, returnY, undefined, undefined, undefined);
        this.cleanupDragSession();
    }

    private completeDrop(result: TileDragDropResult): void {
        this.dndState.notifyDrop(result);
        this.cleanupDragSession();
    }

    private applySwapPreview(tiles: Array<PlacedTile>): void {
        this.dndState.setPreviewOverride(tiles);
    }

    private restorePreview(): void {
        this.dndState.setPreviewOverride(undefined);
    }

    private getBaseTiles(): Array<PlacedTile> {
        return this.dndState.committedTiles();
    }

    private cleanupDragSession(): void {
        this.highlightManager.clearAll();
        this.sessionManager.endSession();
        this.dragPreview.destroy();
        this.cachedGridConfig = undefined;
    }

    private registerMouseListeners(): void {
        this.mouseMoveHandler = (event: MouseEvent): void => {
            this.handleDragOver(event.clientX, event.clientY);
        };
        this.mouseUpHandler = (event: MouseEvent): void => {
            void this.handleDrop(event.clientX, event.clientY);
            this.removeMouseListeners();
        };
        document.addEventListener("mousemove", this.mouseMoveHandler);
        document.addEventListener("mouseup", this.mouseUpHandler);
    }

    private removeMouseListeners(): void {
        if (this.mouseMoveHandler) {
            document.removeEventListener("mousemove", this.mouseMoveHandler);
            this.mouseMoveHandler = undefined;
        }
        if (this.mouseUpHandler) {
            document.removeEventListener("mouseup", this.mouseUpHandler);
            this.mouseUpHandler = undefined;
        }
    }

    private registerTouchListeners(): void {
        this.touchMoveHandler = (event: TouchEvent): void => {
            this.onTouchMove(event);
        };
        this.touchEndHandler = (event: TouchEvent): void => {
            this.onTouchEnd(event);
        };
        document.addEventListener("touchmove", this.touchMoveHandler, { passive: false });
        document.addEventListener("touchend", this.touchEndHandler);
        document.addEventListener("touchcancel", this.touchEndHandler);
    }

    private removeTouchListeners(): void {
        if (this.touchMoveHandler) {
            document.removeEventListener("touchmove", this.touchMoveHandler);
            this.touchMoveHandler = undefined;
        }
        if (this.touchEndHandler) {
            document.removeEventListener("touchend", this.touchEndHandler);
            document.removeEventListener("touchcancel", this.touchEndHandler);
            this.touchEndHandler = undefined;
        }
    }

    private onTouchMove(event: TouchEvent): void {
        event.preventDefault();
        if (event.touches.length !== 1) {
            return;
        }

        const touch = event.touches[0];

        if (!this.gestureRecognizer.isPending) {
            this.handleDragOver(touch.clientX, touch.clientY);

            return;
        }

        const gestureResult: GestureMoveResult<PendingResizeTouchData> | undefined =
            this.gestureRecognizer.evaluateMove(touch.clientX, touch.clientY);
        if (!gestureResult) {
            return;
        }

        const grabOffset = TileGridHelper.calculateGrabOffset(
            gestureResult.data.tileEl,
            gestureResult.touchStart.clientX,
            gestureResult.touchStart.clientY,
            gestureResult.data.placedTile.position,
        );

        const rect = gestureResult.data.tileEl?.getBoundingClientRect();
        const centerX = rect ? rect.left + rect.width / 2 : gestureResult.touchStart.clientX;
        const centerY = rect ? rect.top + rect.height / 2 : gestureResult.touchStart.clientY;

        this.sessionManager.startMoveSession(
            gestureResult.data.placedTile,
            grabOffset.grabOffsetRow,
            grabOffset.grabOffsetCol,
            centerX,
            centerY,
        );

        this.dragPreview.create(
            gestureResult.data.tileEl,
            touch.clientX,
            touch.clientY,
            GRID_TILE_BORDER_RADIUS,
            this.gridContainer,
        );
    }

    private onTouchEnd(event: TouchEvent): void {
        if (this.gestureRecognizer.isPending) {
            this.gestureRecognizer.cancelGesture();
            this.removeTouchListeners();

            return;
        }

        const session = this.sessionManager.dragSession();
        if (!session) {
            this.removeTouchListeners();

            return;
        }

        const touch = event.changedTouches[0];
        void this.handleDrop(touch.clientX, touch.clientY);
        this.removeTouchListeners();
    }

    private readGridConfig(): GridConfig {
        if (this.cachedGridConfig) {
            return this.cachedGridConfig;
        }

        const style = getComputedStyle(this.gridContainer);

        this.cachedGridConfig = {
            rows: parseInt(style.getPropertyValue("--dnd-grid-rows"), 10) || 3,
            columns: parseInt(style.getPropertyValue("--dnd-grid-cols"), 10) || 4,
        };

        return this.cachedGridConfig;
    }

    private getTileGeometry(
        position: TilePosition,
    ): { x: number; y: number; width: number; height: number } | undefined {
        const rowEnd = position.rowStart + position.rowSpan - 1;
        const colEnd = position.columnStart + position.columnSpan - 1;

        const cells = Array.from(this.gridContainer.querySelectorAll<HTMLElement>("dnd-grid-cell"));

        const topLeft = cells.find(
            (cell: HTMLElement): boolean =>
                cell.style.gridRowStart === String(position.rowStart) &&
                cell.style.gridColumnStart === String(position.columnStart),
        );
        const bottomRight = cells.find(
            (cell: HTMLElement): boolean =>
                cell.style.gridRowStart === String(rowEnd) && cell.style.gridColumnStart === String(colEnd),
        );

        if (!topLeft || !bottomRight) {
            return undefined;
        }

        const tlRect = topLeft.getBoundingClientRect();
        const brRect = bottomRight.getBoundingClientRect();

        return {
            x: (tlRect.left + brRect.right) / 2,
            y: (tlRect.top + brRect.bottom) / 2,
            width: brRect.right - tlRect.left,
            height: brRect.bottom - tlRect.top,
        };
    }

    private readPaletteTargetGeometry(
        availableCount: number,
    ): { x: number; y: number; width: number; height: number } | undefined {
        const item = this.paletteContainer.querySelector<HTMLElement>("dnd-palette-drag");
        const style = getComputedStyle(this.paletteContainer);
        const paletteCols = parseInt(style.getPropertyValue("--dnd-grid-cols"), 10) || 4;
        const gap = parseFloat(style.columnGap) || 0;

        let xOrigin: number;
        let yOrigin: number;
        let itemWidth: number;
        let itemHeight: number;

        if (item) {
            const firstRect = item.getBoundingClientRect();

            if (firstRect.width <= 0 || firstRect.height <= 0) {
                return undefined;
            }

            xOrigin = firstRect.left;
            yOrigin = firstRect.top;
            itemWidth = firstRect.width;
            itemHeight = firstRect.height;
        } else {
            // palette is empty — estimate slot dimensions from the container and computed CSS.
            const containerRect = this.paletteContainer.getBoundingClientRect();

            if (containerRect.width <= 0) {
                return undefined;
            }

            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;

            itemWidth = (containerRect.width - 2 * paddingLeft - (paletteCols - 1) * gap) / paletteCols;
            itemHeight = containerRect.height - 2 * paddingTop;
            xOrigin = containerRect.left + paddingLeft;
            yOrigin = containerRect.top + paddingTop;
        }

        const column = availableCount % paletteCols;
        const row = Math.floor(availableCount / paletteCols);

        return {
            x: xOrigin + column * (itemWidth + gap) + itemWidth / 2,
            y: yOrigin + row * (itemHeight + gap) + itemHeight / 2,
            width: itemWidth,
            height: itemHeight,
        };
    }
}
