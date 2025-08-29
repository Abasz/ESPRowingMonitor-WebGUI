```markdown
---
schemaVersion: 1
name: "Angular component tests guidance"
description: "Instructions for Copilot/LLM to generate high-quality Angular component unit tests (Jasmine/Karma style)."
applyTo: "**/*.spec.ts"
language: "typescript"
tags:
  - angular
  - testing
  - unit-tests
  - jasmine
  - karma
---

# Instruction for Copilot Agent — Write High‑Quality Angular Component Unit Tests

**Audience:** GitHub Copilot / LLM agent assisting on an Angular app.

**Scope:** Component unit tests only (Jasmine/Karma style by default). Base guidance strictly on Angular's official component‑testing docs (basics & scenarios). Assume Angular v17+ (v20 docs). Tailor examples to standalone components unless the project uses NgModules.

---

## Goals for the Agent

1. Produce **concise, behavior‑focused** specs that verify template ↔ class interaction and user‑visible outcomes.
2. Prefer **component DOM tests** over class‑only tests when behavior depends on the template.
3. Keep tests **isolated, fast, and deterministic** (mock external dependencies; avoid real network/time).
4. Generate tests that are **readable and maintainable** (clear Arrange/Act/Assert; minimal duplication; helper utilities where appropriate).

---

## Default Test Structure

- **Describe** block named after the component/service under test.
- **Setup via `TestBed`**:
  - *Standalone*: add the component to `imports: [ComponentUnderTest]` and include any required directives/pipes/components/services.
  - *NgModule*: import the feature/testing module(s) that declare the component.
- **Create fixture** with `TestBed.createComponent(ComponentUnderTest)` and keep references to `fixture`, `component`, and optionally `loader` for harness testing.
- **Trigger change detection** explicitly with `fixture.detectChanges()` after setting inputs or simulating events.
- **Query the DOM** using `fixture.nativeElement.querySelector(...)` for simple selectors or `fixture.debugElement.query(By.css(...))` when you need `DebugElement` utilities.
- **Assert** on DOM text/attributes, emitted outputs, and side‑effects visible through the template.

### Canonical skeleton (standalone component)

```ts
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from '@angular/platform-browser';
import { MyWidgetComponent } from './my-widget.component';

describe('MyWidgetComponent', (): void => {
  let component: MyWidgetComponent;
  let fixture: ComponentFixture<MyWidgetComponent>;

  beforeEach((): void => {
    TestBed.configureTestingModule({
      imports: [MyWidgetComponent],
      providers: [provideZonelessChangeDetection()],
    });

    fixture = TestBed.createComponent(MyWidgetComponent);
    component = fixture.componentInstance;
  });

  describe("as part of component creation", (): void => {
    it('should create the component', (): void => {
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

- Use **void or Promise<void> return types** for all describe/it blocks: `(): void =>` or `(): Promise<void> =>`
- Group related tests using nested `describe` blocks with descriptive names
- Use common groupings like:
  - `"as part of component creation"` for basic component setup tests
  - `"as part of template rendering"` for DOM-related tests
  - `"{methodName} method"` for specific method testing
  - `"when {condition}"` for conditional behavior testing
  - `" as part of edge cases & robustness handling"` for error handling and boundary conditions

### 2) **Change detection** is explicit

- After changing inputs, calling public methods, or firing DOM events, call `fixture.detectChanges()` to update the view.
- Remember: initial `detectChanges()` will run lifecycle hooks such as `ngOnInit`.
- Always provide `provideZonelessChangeDetection()` in providers array.

### 3) **DOM queries and interactions**

- Simple reads: `fixture.nativeElement.querySelector(...)`.
- Use `fixture.nativeElement.querySelectorAll(...)` for multiple elements.
- When you need Angular's testing utilities, use `fixture.debugElement.query(By.css(...))`.
- For Material components, prefer using `@angular/cdk/testing` harnesses when available. Official guide related to testing: https://material.angular.io/cdk/testing/overview and the API documentation: https://material.angular.dev/components/categories (each component has its own section where the related test harness API can be found)


### 4) **Inputs / Outputs**

- **Inputs**: Use `fixture.componentRef.setInput("inputName", value)` for setting inputs in newer Angular versions. Set them on `component` *before* the first `detectChanges()` where possible. For subsequent updates, set the property and call `detectChanges()` again.
- **Outputs**: subscribe to the component's `EventEmitter` or simulate user interaction and assert on side‑effects.
- Prefer simulating real DOM events (e.g., `button.click()`).

### 5) **Async patterns and observables**

- Use `fakeAsync` + `tick()` for time-based testing (i.e. where there is an underlying timer, like setTimeout).
- Use `BehaviorSubject` or `Subject` for mocking observable services.
- For promises, use `await fixture.whenStable(); fixture.detectChanges()`.
- Always call `done()` callback when using subscription-based tests.
- For services that return async data, use spies/stubs that return `of(...)`/`throwError(...)` (sync) or custom helpers that schedule emissions (async) to exercise loading and error states.

### 6) **Spies and test doubles**

- Use `jasmine.createSpyObj` (preferred) for service mocks with minimal surface.
- Create spies in `beforeEach` and reset them between tests when needed.
- Provide spies via `providers` in the testing module for **root‑level** services, then get them with `TestBed.inject(...)` in your test.
- If a service is provided **by the component itself** (in its `providers`), use `TestBed.overrideComponent(ComponentUnderTest, { set: { providers: [...] } })` to replace them with fakes.
- Use descriptive spy names that match the actual service methods.
- Mock only what the component actually uses.

### 7) **Signal testing patterns**

```ts
// Testing signal updates
component.someSignal.set(newValue);
expect(component.someSignal()).toBe(newValue);

// Testing computed signals
expect(component.computedSignal()).toBe(expectedValue);

// Testing signal effects on DOM
fixture.detectChanges();
expect(fixture.nativeElement.textContent).toContain(expectedText);
```
### 8) **Routed components**

- For components that read route params (e.g., from `ActivatedRoute.paramMap`), stub the route param observable and/or navigate in tests, then detect changes and assert rendering and side‑effects.
---

## Project-Specific Patterns

### A) BLE Characteristic Testing Pattern

For services using BLE characteristics with `observeValue$`, use this pattern:

```ts
// Mock characteristic with event simulation
const createMockCharacteristic = (): BluetoothRemoteGATTCharacteristic => {
  return {
    service: { device: createMockBluetoothDevice() },
    readValue: jasmine.createSpy("readValue").and.resolveTo(mockDataView),
    startNotifications: jasmine.createSpy("startNotifications").and.resolveTo(),
    addEventListener: jasmine.createSpy("addEventListener"),
    removeEventListener: jasmine.createSpy("removeEventListener"),
  } as unknown as BluetoothRemoteGATTCharacteristic;
};

// Testing observable emissions
const valueChangedListenerReady = async (broadcastValue?: DataView) => {
  mockCharacteristic.addEventListener = jasmine
    .createSpy("addEventListener")
    .and.callFake((eventType: string, handler: (event: Event) => void) => {
      if (eventType === "characteristicvaluechanged" && broadcastValue) {
        handler({ target: { value: broadcastValue } } as unknown as Event);
      }
    });
};
```

### B) Service with Observable Dependencies

```ts
let serviceSubject: BehaviorSubject<SomeType>;

beforeEach((): void => {
  serviceSubject = new BehaviorSubject<SomeType>(mockInitialValue);
  
  const mockService = {
    someObservable$: serviceSubject.asObservable(),
    someMethod: jasmine.createSpy("someMethod"),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: SomeService, useValue: mockService },
      provideZonelessChangeDetection(),
    ],
  });
});
```

### C) Dialog Component Testing

```ts
const mockDialogRef = jasmine.createSpyObj("MatDialogRef", ["close"]);
const mockDialogData = { someProperty: "test value" };

beforeEach((): void => {
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialogRef, useValue: mockDialogRef },
      { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      provideZonelessChangeDetection(),
    ],
  });
});
```

### D) File Upload Testing

```ts
const createInputWithFiles = (files: Array<File> | null): HTMLInputElement => {
  const input = document.createElement("input");
  Object.defineProperty(input, "files", {
    value: files ? {
      0: files[0],
      length: files.length,
      item: (i: number): File => files[i],
      [Symbol.iterator]: function* (): IterableIterator<File> {
        for (let i = 0; i < files.length; i++) yield files[i];
      },
    } : null,
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
// Mock Dexie database operations
const mockTransaction = jasmine.createSpy("transaction").and.returnValue(Dexie.Promise.resolve());
const mockTable = {
  add: jasmine.createSpy("add").and.returnValue(Dexie.Promise.resolve()),
  put: jasmine.createSpy("put").and.returnValue(Dexie.Promise.resolve()),
  where: jasmine.createSpy("where").and.returnValue({
    first: jasmine.createSpy("first").and.returnValue(Dexie.Promise.resolve(mockData)),
  }),
};
```

### G) Using a **test host** component

```ts
@Component({
  standalone: true,
  imports: [DashboardHeroComponent],
  template: `<app-dashboard-hero [hero]="hero" (selected)="onSel($event)"></app-dashboard-hero>`
})
class HostComponent {
  hero = { id: 1, name: 'Ada' } as Hero;
  selectedHero?: Hero;
  onSel(h: Hero) { this.selectedHero = h; }
}

TestBed.configureTestingModule({ imports: [HostComponent] });
const fixture = TestBed.createComponent(HostComponent);
fixture.detectChanges();

fixture.nativeElement.querySelector('app-dashboard-hero button').click();
fixture.detectChanges();

expect(fixture.componentInstance.selectedHero?.name).toBe('ADA'); // if pipe uppercases
```
---

## Testing Conventions Observed in Codebase

### Naming and Organization

- Test files follow `{component-name}.component.spec.ts` pattern
- Use `"should {verb} {expected outcome}"` for test descriptions
- Group tests by functionality using nested describes
- Use `beforeEach` for common setup, avoid repeating initialization

### Mock Patterns

- Create factory functions for complex mocks (e.g., `createMockBluetoothDevice`)
- Use `jasmine.createSpyObj` with minimal method surface
- Reset spies with `.calls.reset()` when needed between tests
- Use `and.callThrough()` when you want to preserve original implementation

### Assertion Patterns

- Use `expect().toBeTruthy()` for existence checks
- Use `expect().toBe()` for primitive equality
- Use `expect().toEqual()` for object comparison
- Use `expect().toContain()` for string/array inclusion
- Use contextual messages with `expect().withContext("message").toBe()`
- Use `expect().toHaveSize()` for checking length of array like structures

### Error Testing

- Use `expect().toThrowError()` for synchronous errors
- Use `expectAsync().toBeRejected()` for async errors
- Test both error paths and success paths
- Mock console.error when testing error logging

### G) Routed component reading `ActivatedRoute`

```ts
const param$ = new BehaviorSubject(convertToParamMap({ id: '42' }));
const routeStub = { paramMap: param$.asObservable() } as Partial<ActivatedRoute>;

TestBed.configureTestingModule({
  imports: [HeroDetailComponent],
  providers: [{ provide: ActivatedRoute, useValue: routeStub }]
});

const fixture = TestBed.createComponent(HeroDetailComponent);
fixture.detectChanges();

expect(fixture.nativeElement.querySelector('h2')?.textContent)
  .toContain('42');
```
---

## Guardrails & Gotchas

- **Don't** reconfigure `TestBed` after the component/fixture has been created in the same spec.
- **Always** call `fixture.detectChanges()` after state changes.
- **Use** `skip()` operator when testing observables that emit initial values.
- **Mock** external dependencies completely - no real network, file system, or time operations.
- **Test** user-visible behavior, not internal implementation details.
- **Use** `fakeAsync`/`tick()` for time-dependent tests.
- **Don't** test private methods or properties directly (unless its absolutely unavoidable).
- **Don't** spy on private methods or properties directly (unless its absolutely unavoidable).
- **Don't** spy on console statements (unless there is nothing else to test the completion of a specific functionality).
---

## Checklist for Code Review

- [ ] Uses `provideZonelessChangeDetection()` in providers
- [ ] All functions use void return types: `(): void =>` or `(): Promise<void> =>`
- [ ] Tests grouped logically with descriptive `describe` blocks
- [ ] Mocks are minimal and focused on used functionality
- [ ] DOM interactions followed by `fixture.detectChanges()`
- [ ] Async tests where necessary use proper patterns (`fakeAsync`/`tick`, `done()` callbacks) but generally it should be avoided
- [ ] Error cases are tested alongside success cases
- [ ] File follows naming convention `{name}.spec.ts`
- [ ] No real external dependencies (network, time, file system)