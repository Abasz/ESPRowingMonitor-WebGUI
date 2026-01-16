
# Instruction for Copilot Agent — Write High‑Quality Angular Unit Tests with Vitest

**Audience:** GitHub Copilot / LLM agent assisting on an Angular app.

**Scope:** Unit tests using Vitest as the test framework (Angular v21+ default). Base guidance on Angular's official testing docs and Vitest documentation. Tailor examples to standalone components.

---

## Goals for the Agent

1. Produce **concise, behavior‑focused** specs that verify template ↔ class interaction and user‑visible outcomes.
2. Prefer **component DOM tests** over class‑only tests when behavior depends on the template.
3. Keep tests **isolated, fast, and deterministic** (mock external dependencies; avoid real network/time).
4. Generate tests that are **readable and maintainable** (clear Arrange/Act/Assert; minimal duplication; helper utilities where appropriate).

---

## Default Test Structure

- **Describe** block named after the component/service under test. Use "Shouldly" style named descrirbe and it sections
- **Setup via `TestBed`**:
  - *Standalone*: add the component to `imports: [ComponentUnderTest]` and include any required directives/pipes/components/services.
- **Create fixture** with `TestBed.createComponent(ComponentUnderTest)` and keep references to `fixture`, `component`, and optionally `loader` for harness testing.
- **Trigger change detection** explicitly with `fixture.detectChanges()` after setting inputs or simulating events.
- **Query the DOM** using `fixture.nativeElement.querySelector(...)` for simple selectors or `fixture.debugElement.query(By.css(...))` when you need `DebugElement` utilities.
- **Assert** on DOM text/attributes, emitted outputs, and side‑effects visible through the template.

### Canonical skeleton (standalone component)

```ts
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyWidgetComponent } from "./my-widget.component";

describe("MyWidgetComponent", (): void => {
    let component: MyWidgetComponent;
    let fixture: ComponentFixture<MyWidgetComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [MyWidgetComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(MyWidgetComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("doSomething method", (): void => {
        it("should do the thing it supposed to do", (): void => {
            // here comes the test body in AAA style
        });
    });
});
```

---

## Core Practices the Agent Must Enforce

### 1) Test Structure and Organization

- Use **void or Promise<void> return types** for all describe/it blocks: `(): void =>` or `async (): Promise<void> =>`
- Group related tests using nested `describe` blocks with descriptive names
- Use common groupings like:
  - `"as part of component creation"` for basic component setup tests
  - `"as part of template rendering"` for DOM-related tests
  - `"{methodName} method"` for specific method testing
  - `"when {condition}"` for conditional behavior testing
  - `"as part of edge cases & robustness handling"` for error handling and boundary conditions

### 2) Import Vitest Functions Explicitly

Always import test functions from `vitest` directly:

```ts
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
```

### 3) **Change detection** is explicit

- After changing inputs, calling public methods, or firing DOM events, call `fixture.detectChanges()` to update the view.
- Remember: initial `detectChanges()` will run lifecycle hooks such as `ngOnInit`.

### 4) **DOM queries and interactions**

- Simple reads: `fixture.nativeElement.querySelector(...)`.
- Use `fixture.nativeElement.querySelectorAll(...)` for multiple elements.
- When you need Angular's testing utilities, use `fixture.debugElement.query(By.css(...))`.
- For Material components, prefer using `@angular/cdk/testing` harnesses when available. Official guide related to testing: https://material.angular.io/cdk/testing/overview

### 5) **Inputs / Outputs**

- **Inputs**: Use `fixture.componentRef.setInput("inputName", value)` for setting inputs in newer Angular versions. Set them on `component` *before* the first `detectChanges()` where possible. For subsequent updates, set the property and call `detectChanges()` again.
- **Outputs**: components are using output signal so simulate user interaction and assert on side‑effects.
- Prefer simulating real DOM events (e.g., `button.click()`).

### 6) **Async patterns and observables**

- Use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` or `vi.runAllTimers()` for time-based testing (i.e. where there is an underlying timer, like setTimeout).
- Use `BehaviorSubject` or `Subject` for mocking observable services.
- For promises, use `await fixture.whenStable(); fixture.detectChanges()`.
- For services that return async data, use mocks that return `of(...)`/`throwError(...)` (sync) or custom helpers that schedule emissions (async) to exercise loading and error states.

**Important**: Vitest does not support the `done()` callback style. Use async/await or return a Promise instead:

```ts
// ❌ Wrong - Vitest doesn't support done callback
it("should work", (done) => {
    someAsyncOperation().then(() => {
        expect(result).toBe(true);
        done();
    });
});

// ✅ Correct - use async/await
it("should work", async (): Promise<void> => {
    await someAsyncOperation();
    expect(result).toBe(true);
});

// ✅ Correct - return a Promise
it("should work", (): Promise<void> => {
    return someAsyncOperation().then(() => {
        expect(result).toBe(true);
    });
});
```

### 7) **Vitest Mocking with `vi.fn()` and `vi.spyOn()`**

Use `vi.fn()` to create mock functions and `vi.spyOn()` to spy on existing methods:

```ts
// Creating a mock function
const mockMethod = vi.fn();
mockMethod.mockReturnValue("mocked value");
mockMethod.mockResolvedValue("async mocked value");
mockMethod.mockImplementation(() => "custom implementation");

// Spying on an existing method
const spy = vi.spyOn(service, "methodName");
spy.mockReturnValue("mocked");

// Spying on a getter
vi.spyOn(navigator, "bluetooth", "get").mockReturnValue(mockBluetooth);

// Type-safe mocking with vi.mocked()
vi.mocked(mockService.method).mockReturnValue("value");
```

**Note:** if you set up a spy on a global value you need to expclitly reset/restore them (with e.g. restoreAllMocks preferably in the afterEach)

### 8) **Creating Mock Services**

Create mock services with explicit types for better maintainability:

```ts
let mockService: Pick<ActualService, "method1" | "method2" | "observable$">;

beforeEach((): void => {
    mockService = {
        method1: vi.fn(),
        method2: vi.fn(),
        observable$: vi.fn(),
    };
    vi.mocked(mockService.method1).mockReturnValue("value");
    vi.mocked(mockService.observable$).mockReturnValue(of(mockData));

    TestBed.configureTestingModule({
        providers: [
            { provide: ActualService, useValue: mockService },
        ],
    });
});
```

### 9) **Signal testing patterns**

Do not try to return values when spying on a signal. Rather explicitly return a  local WritableSignal that we can control.

```ts
import { signal, WritableSignal } from "@angular/core";

// Creating mock signals for services
let mockSignal: WritableSignal<SomeType>;

beforeEach((): void => {
    mockSignal = signal<SomeType>(initialValue);
    
    mockService = {
        someSignal: mockSignal,
    };
});

// Testing signal updates
it("should update signal value", (): void => {
    mockSignal.set(newValue);
    expect(mockSignal()).toBe(newValue);
});

// Testing computed signals
expect(component.computedSignal()).toBe(expectedValue);

// Testing signal effects on DOM
fixture.detectChanges();
expect(fixture.nativeElement.textContent).toContain(expectedText);
```

### 10) **Mocking Modules with `vi.mock()`**

In general try to avoid `vi.mock()` and mocking modules as much as possible as it is unstable with Angular. Use this as a last resort and apply extreme caution.

When you need to mock an imported module (e.g., to control version data) and there is no other way:

```ts
// Import the module as a namespace to spy on it
import * as versionModule from "../../data/version";

// Or use vi.mock() for complete module replacement (hoisted to top of file)
vi.mock("../../data/version", () => ({
    versionInfo: {
        latestFirmwareRelease: {
            version: "1.0.0",
            updatedAt: "2025-01-01T00:00:00Z",
        },
    },
}));

// For dynamic mocking, use vi.spyOn with getter accessor
vi.spyOn(versionModule, "versionInfo", "get").mockReturnValue(mockVersionInfo);
```

**Important**: `vi.mock()` calls are hoisted to the top of the file. If you need to reference variables, use `vi.hoisted()`:

```ts
const mockData = vi.hoisted(() => ({
    someValue: "test",
}));

vi.mock("./module", () => ({
    exportedValue: mockData.someValue,
}));
```

### 11) **Fake Timers**

Fake timers are needed when testing delays, retries for RxJs observables.

```ts
beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(mockTimeStamp);
});

afterEach((): void => {
    vi.useRealTimers();
});

it("should handle time-based operations", (): void => {
    // Trigger time-dependent code
    vi.advanceTimersByTime(1000); // Advance by 1 second
    // or
    vi.runAllTimers(); // Run all pending timers
});
```

### 12) **Routed components**

```ts
import { BehaviorSubject } from "rxjs";
import { convertToParamMap } from "@angular/router";

const param$ = new BehaviorSubject(convertToParamMap({ id: "42" }));
const routeStub = { paramMap: param$.asObservable() } as Partial<ActivatedRoute>;

TestBed.configureTestingModule({
    imports: [HeroDetailComponent],
    providers: [{ provide: ActivatedRoute, useValue: routeStub }],
});
```

---

## Project-Specific Patterns

### A) BLE Characteristic Testing Pattern

For services using BLE characteristics with `observeValue$`, use this pattern:

```ts
import { vi } from "vitest";

// Mock characteristic with event simulation
export const createMockBluetoothDevice = (
    id: string = "test-device-id",
    name: string = "TestDevice",
    isConnected: boolean = false,
): BluetoothDevice => {
    const mockGATT = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        getPrimaryService: vi.fn(),
        get connected(): boolean {
            return isConnected;
        },
    } as unknown as BluetoothRemoteGATTServer;

    const mockDevice = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        watchAdvertisements: vi.fn().mockResolvedValue(undefined),
        get id(): string {
            return id;
        },
        get name(): string {
            return name;
        },
        get gatt(): BluetoothRemoteGATTServer {
            return mockGATT;
        },
    } as unknown as BluetoothDevice;

    return mockDevice;
};

export const createMockCharacteristic = (device: BluetoothDevice): BluetoothRemoteGATTCharacteristic => {
    const mockCharacteristic = {
        readValue: vi.fn(),
        startNotifications: vi.fn(),
        stopNotifications: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        writeValueWithoutResponse: vi.fn(),
    } as unknown as BluetoothRemoteGATTCharacteristic;

    return mockCharacteristic;
};
```

### B) Service with Observable Dependencies

```ts
let serviceSubject: BehaviorSubject<SomeType>;

beforeEach((): void => {
    serviceSubject = new BehaviorSubject<SomeType>(mockInitialValue);

    const mockService = {
        someObservable$: serviceSubject.asObservable(),
        someMethod: vi.fn(),
    };

    TestBed.configureTestingModule({
        providers: [{ provide: SomeService, useValue: mockService }],
    });
});
```

### C) Dialog Component Testing

```ts
const mockDialogRef = {
    close: vi.fn(),
    updateSize: vi.fn(),
    backdropClick: vi.fn(),
    keydownEvents: vi.fn(),
    disableClose: false,
};
vi.mocked(mockDialogRef.backdropClick).mockReturnValue(EMPTY);
vi.mocked(mockDialogRef.keydownEvents).mockReturnValue(EMPTY);

const mockDialogData = { someProperty: "test value" };

beforeEach((): void => {
    TestBed.configureTestingModule({
        providers: [
            { provide: MatDialogRef, useValue: mockDialogRef },
            { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
    });
});
```

### D) File Upload Testing

```ts
const createInputWithFiles = (files: Array<File> | null): HTMLInputElement => {
    const input = document.createElement("input");
    Object.defineProperty(input, "files", {
        value: files
            ? {
                  0: files[0],
                  length: files.length,
                  item: (i: number): File => files[i],
                  [Symbol.iterator]: function* (): IterableIterator<File> {
                      for (let i = 0; i < files.length; i++) yield files[i];
                  },
              }
            : null,
        writable: true,
    });
    return input;
};
```

### E) Material Component Testing with Harnesses

```ts
import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { MatButtonHarness } from "@angular/material/button/testing";

let loader: HarnessLoader;

beforeEach((): void => {
    // ... TestBed setup
    loader = TestbedHarnessEnvironment.loader(fixture);
});

it("should interact with button", async (): Promise<void> => {
    const button = await loader.getHarness(MatButtonHarness.with({ text: "Click me" }));
    await button.click();
    expect(component.wasClicked()).toBe(true);
});
```

### F) Database/IndexedDB Testing

```ts
// Setup spies on database methods
let tablePutSpy: Mock;
let tableWhereSpy: Mock;

beforeEach((): void => {
    tablePutSpy = vi.spyOn(appDB.tableName, "put");
    tableWhereSpy = vi.spyOn(appDB.tableName, "where");
});

afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    // Clean up database after each test
    await appDB.tableName.clear();
});
```

### G) Using a **test host** component

```ts
@Component({
    standalone: true,
    imports: [DashboardHeroComponent],
    template: `<app-dashboard-hero [hero]="hero" (selected)="onSel($event)"></app-dashboard-hero>`,
})
class HostComponent {
    hero = { id: 1, name: "Ada" } as Hero;
    selectedHero?: Hero;
    onSel(h: Hero): void {
        this.selectedHero = h;
    }
}

TestBed.configureTestingModule({ imports: [HostComponent] });
const fixture = TestBed.createComponent(HostComponent);
fixture.detectChanges();

fixture.nativeElement.querySelector("app-dashboard-hero button").click();
fixture.detectChanges();

expect(fixture.componentInstance.selectedHero?.name).toBe("ADA");
```

### H) HTTP Testing with HttpTestingController

```ts
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";

let httpTesting: HttpTestingController;

beforeEach((): void => {
    TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
});

afterEach((): void => {
    httpTesting.verify();
});

it("should make HTTP request", (): void => {
    service.fetchData().subscribe();

    const req = httpTesting.expectOne("/api/data");
    expect(req.request.method).toBe("GET");

    req.flush({ data: "test" });
});
```

### I) Testing with Dynamic Test Data from Imports

When tests depend on imported data that may change (e.g., version info), derive test values dynamically:

```ts
import { versionInfo } from "../../data/version";

// Helper to derive test dates from actual data
function getTestDates(): {
    olderThanRelease: string;
    sameAsRelease: string;
    newerThanRelease: string;
} {
    const releaseDate = new Date(versionInfo.latestFirmwareRelease.updatedAt);
    const releaseDateOnly = new Date(
        releaseDate.getFullYear(),
        releaseDate.getMonth(),
        releaseDate.getDate(),
    );

    const olderDate = new Date(releaseDateOnly);
    olderDate.setDate(olderDate.getDate() - 30);

    const newerDate = new Date(releaseDateOnly);
    newerDate.setDate(newerDate.getDate() + 1);

    return {
        olderThanRelease: formatAsFirmwareVersion(olderDate),
        sameAsRelease: formatAsFirmwareVersion(releaseDateOnly),
        newerThanRelease: formatAsFirmwareVersion(newerDate),
    };
}

const testDates = getTestDates();
```

---

## Testing Conventions Observed in Codebase

### Naming and Organization

- Test files follow `{component-name}.component.spec.ts` or `{service-name}.service.spec.ts` pattern
- Use `"should {verb} {expected outcome}"` for test descriptions
- Group tests by functionality using nested describes
- Use `beforeEach` for common setup, avoid repeating initialization

### Mock Patterns

- Create factory functions for complex mocks (e.g., `createMockBluetoothDevice`)
- Use `vi.fn()` to create mock functions
- Use `vi.mocked()` for type-safe mock configuration
- Reset/restore mocks with `vi.restoreAllMocks()` in `afterEach` when needed
- Use `vi.spyOn()` when you want to preserve original implementation or spy on existing methods

### Assertion Patterns

- Use `expect().toBeTruthy()` for existence checks
- Use `expect().toBe()` for primitive equality
- Use `expect().toEqual()` for object comparison
- Use `expect().toContain()` for string/array inclusion
- Use `expect().toHaveLength()` for checking array/string length
- Use `expect().toHaveBeenCalled()` for verifying mock calls
- Use `expect().toHaveBeenCalledWith()` for verifying call arguments
- Use `expect().toHaveBeenCalledTimes()` for verifying call count

### Error Testing

```ts
// Synchronous errors
expect(() => throwingFunction()).toThrowError("error message");

// Async errors with rejects
await expect(asyncFunction()).rejects.toThrowError("error message");

// Test both error paths and success paths
// Mock console.error when testing error logging
vi.spyOn(console, "error").mockImplementation(() => {});
```

---

## Jasmine to Vitest Migration Reference

| Jasmine | Vitest |
|---------|--------|
| `jasmine.createSpy()` | `vi.fn()` |
| `jasmine.createSpyObj("name", ["method"])` | Create object with `vi.fn()` methods |
| `spyOn(obj, "method")` | `vi.spyOn(obj, "method")` |
| `spy.and.returnValue(val)` | `spy.mockReturnValue(val)` |
| `spy.and.callFake(fn)` | `spy.mockImplementation(fn)` |
| `spy.and.resolveTo(val)` | `spy.mockResolvedValue(val)` |
| `spy.and.rejectWith(err)` | `spy.mockRejectedValue(err)` |
| `spy.and.callThrough()` | Spy without mock implementation |
| `spy.calls.reset()` | `spy.mockClear()` |
| `expect().toHaveBeenCalledOnceWith()` | `expect().toHaveBeenCalledWith()` + `expect().toHaveBeenCalledTimes(1)` |
| `expectAsync().toBeResolved()` | `await expect().resolves` |
| `expectAsync().toBeRejected()` | `await expect().rejects` |
| `fakeAsync()` / `tick()` | `vi.useFakeTimers()` / `vi.advanceTimersByTime()` |
| `done` callback | Use `async/await` or return Promise |

---

## Guardrails & Gotchas

- **Don't** reconfigure `TestBed` after the component/fixture has been created in the same spec.
- **Always** call `fixture.detectChanges()` after state changes.
- **Use** `vi.restoreAllMocks()` in `afterEach` to clean up spies between tests.
- **Use** `vi.useRealTimers()` in `afterEach` if you used `vi.useFakeTimers()`.
- **Mock** external dependencies completely - no real network, file system, or time operations.
- **Test** user-visible behavior, not internal implementation details.
- **Don't** test private methods or properties directly (unless absolutely unavoidable).
- **Don't** spy on private methods or properties directly (unless absolutely unavoidable).
- **Don't** spy on console statements (unless there is nothing else to test the completion of a specific functionality).
- **Remember** `vi.mock()` calls are hoisted - they execute before imports.

---

## Checklist for Code Review

- [ ] All test functions imported from `vitest`: `describe, it, expect, beforeEach, afterEach, vi`
- [ ] All functions use void return types: `(): void =>` or `async (): Promise<void> =>`
- [ ] Tests grouped logically with descriptive `describe` blocks
- [ ] Mocks are minimal and focused on used functionality
- [ ] DOM interactions followed by `fixture.detectChanges()`
- [ ] Async tests use `async/await` pattern (not `done` callback)
- [ ] Error cases are tested alongside success cases
- [ ] File follows naming convention `{name}.spec.ts`
- [ ] No real external dependencies (network, time, file system)
- [ ] Mocks cleaned up with `vi.restoreAllMocks()` or `vi.useRealTimers()` in `afterEach`