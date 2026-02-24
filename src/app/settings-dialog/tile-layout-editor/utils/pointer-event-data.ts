export interface PointerEventData {
    readonly clientX: number;
    readonly clientY: number;
    readonly sourceElement: HTMLElement | null;
    readonly preventDefault: () => void;
    readonly stopPropagation: () => void;
}

export function pointerEventFromMouse(event: MouseEvent): PointerEventData {
    return {
        clientX: event.clientX,
        clientY: event.clientY,
        sourceElement: event.currentTarget as HTMLElement | null,
        preventDefault: (): void => event.preventDefault(),
        stopPropagation: (): void => event.stopPropagation(),
    };
}

export function pointerEventFromTouch(event: TouchEvent, touch: Touch): PointerEventData {
    return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        sourceElement: event.currentTarget as HTMLElement | null,
        preventDefault: (): void => event.preventDefault(),
        stopPropagation: (): void => event.stopPropagation(),
    };
}
