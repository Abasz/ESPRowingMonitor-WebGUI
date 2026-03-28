import { vi } from "vitest";

import { GridConfig, PlacedTile } from "./tile-layout.interfaces";

export const simpleTwoTileLayout: Array<PlacedTile> = [
    {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    },
    {
        id: "pace",
        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
    },
];

export const multiSpanTwoTileLayout: Array<PlacedTile> = [
    {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    },
    {
        id: "pace",
        position: { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 2 },
    },
];

export const MOCK_GRID_RECT = { left: 0, top: 0, width: 400, height: 300 };

export const MOCK_GRID_CONFIG: GridConfig = { rows: 3, columns: 4 };

export const createTouchEvent = (
    clientX: number = 0,
    clientY: number = 0,
    touchCount: number = 1,
): TouchEvent => {
    const touch = {
        clientX,
        clientY,
        identifier: 0,
        target: document.createElement("div"),
    } as unknown as Touch;
    const touches =
        touchCount === 1
            ? ([touch] as unknown as TouchList)
            : (Array.from({ length: touchCount }, (): Touch => touch) as unknown as TouchList);

    return {
        type: "touchstart",
        touches,
        changedTouches: [touch] as unknown as TouchList,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        currentTarget: document.createElement("div"),
        cancelable: true,
        bubbles: true,
    } as unknown as TouchEvent;
};
