import '@angular/compiler';
import 'zone.js';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { TestBed, TestComponentRenderer } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

// Runs the actual AppComponent, bulk service and HttpClient over HTTP to Postman.
// The interceptor exists only in this test process; production API URLs are untouched.
const base = process.env.SIMULATION_URL || 'http://127.0.0.1:4900';
const headers = { 'Content-Type': 'application/json', 'x-mock-slug': 'sareevelo' };
const source = resolve('src/app');
mkdirSync('.angular', { recursive: true });
const output = mkdtempSync(resolve('.angular/bulk-http-'));
function compile(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const input = join(folder, entry.name);
    if (entry.isDirectory()) { compile(input); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    const target = join(output, relative(source, input).replace(/\.ts$/, '.js'));
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, ts.transpileModule(readFileSync(input, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, experimentalDecorators: true } }).outputText.replace(/from '(\.[^']+)'/g, "from '$1.js'"));
  }
}
async function waitFor(predicate) {
  const deadline = Date.now() + 30000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for application state'); await new Promise(resolve => setTimeout(resolve, 25)); }
}
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers });
  assert.equal(response.ok, true, `Simulation control request failed: ${response.status}`);
  return response.json();
}
compile(source); writeFileSync(join(output, 'package.json'), '{"type":"module"}');
const { AppComponent } = await import(pathToFileURL(join(output, 'app.component.js')));
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
let component;
try {
  // Profile creation, persisted detail retrieval, and editing use the same real HTTP client.
  await request('/__test/reset', { method: 'POST', body: JSON.stringify({ mode: 'success' }) });
  TestBed.configureTestingModule({ providers: [
    { provide: TestComponentRenderer, useValue: { insertRootElement() {}, removeAllRootElements() {} } },
    provideHttpClient(withFetch(), withInterceptors([(req, next) => next(req.clone({ url: base + req.url, setHeaders: { 'x-mock-slug': 'sareevelo' } }))]))
  ] });
  component = TestBed.runInInjectionContext(() => new AppComponent());
  await waitFor(() => !component.loading() && !component.driversLoading());
  component.currentTab.set('Fleet'); component.openNewDriver(); component.driverName = 'Profile simulation'; component.employeeCode = 'PROFILE-SIM';
  component.mobileNumber = '+49 (151) 234-56789'; component.driverEmail = 'profile@example.com'; component.vehicleType = 'VAN'; component.vehicleRegistration = 'SIM 123'; component.driverNotes = 'Call before arrival';
  component.createDriver(); await waitFor(() => !component.driverSaving() && !component.driversLoading());
  assert.equal(component.driverCreateError(), ''); assert.equal(component.selectedDriver().mobileNumber, '+4915123456789');
  const createdId = component.selectedDriverId(); component.selectDriver(createdId); await waitFor(() => !component.driverDetailLoading());
  assert.equal(component.selectedDriver().notes, 'Call before arrival');
  component.editDriverProfile(); component.driverName = 'Updated profile'; component.driverEmail = ''; component.driverNotes = 'Updated note'; component.createDriver();
  await waitFor(() => !component.driverSaving() && !component.driversLoading());
  const persisted = await request(`/api/v1/drivers/${createdId}`);
  assert.equal(persisted.name, 'Updated profile'); assert.equal(persisted.email, null); assert.equal(persisted.notes, 'Updated note');
  assert.equal(persisted.capacity, 8); assert.equal(persisted.availableSpaces, 8); assert.equal(persisted.status, 'AVAILABLE');
  console.log('PASS driver profile: create, fetch, update, clear email, preserve capacity');
  component.openNewOrder(); component.newCustomer.set('Automatic tracking test'); component.newPickupAddress.set('Pickup'); component.newDestination.set('Delivery');
  component.createOrder(); await waitFor(() => !component.saving());
  assert.equal(component.createError(), ''); assert.equal(component.showNewOrder(), false);
  const generated = component.selectedOrder();
  assert.match(generated.trackingNumber, /^SAR-[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/);
  const savedOrder = await request(`/api/v1/orders/${generated.id}`);
  assert.equal(savedOrder.trackingNumber, generated.trackingNumber);
  const createState = await request('/__test/state'); assert.equal(Object.hasOwn(createState.lastOrderCreate, 'trackingNumber'), false);
  assert.ok(component.toast().includes(generated.trackingNumber));
  console.log('PASS automatic tracking: no client number, generated response displayed and persisted');
  component.editOrder(); component.newDestination.set('Updated destination');
  // A past window intentionally exercises the independently calculated overdue indicator.
  component.deliveryWindowStart = '2020-01-01T10:00'; component.deliveryWindowEnd = '2020-01-01T12:00';
  component.createOrder(); await waitFor(() => !component.saving());
  assert.equal(component.createError(), ''); assert.equal(component.selectedOrder().destination, 'Updated destination');
  assert.equal(component.isOverdue(component.selectedOrder()), true);
  component.openOperationalAlert('overdue'); assert.ok(component.visibleOrders().some(order => order.id === generated.id));
  assert.equal(component.selectedOrder().status, 'PENDING');
  component.assignmentDriverId = 8; component.assignDriver();
  await waitFor(() => !component.assigning() && !component.loading() && !component.driversLoading() && !component.detailLoading());
  assert.equal(component.drivers().find(driver => driver.id === 8).availableSpaces, 2);
  component.requestCancellation(); component.confirmCancellation(); component.confirmCancellation();
  await waitFor(() => !component.cancelling() && !component.loading() && !component.driversLoading() && !component.detailLoading());
  assert.equal(component.cancelError(), ''); assert.equal(component.selectedOrder().status, 'CANCELLED');
  assert.equal(component.drivers().find(driver => driver.id === 8).availableSpaces, 3);
  assert.equal(component.isOverdue(component.selectedOrder()), false); assert.equal(component.visibleOrders().length, 0);
  const cancelled = await request(`/api/v1/orders/${generated.id}`); assert.equal(cancelled.status, 'CANCELLED');
  console.log('PASS scheduling and cancellation: edit persisted, overdue filter matched, capacity released and cancelled order excluded');
  component.ngOnDestroy(); component = undefined; TestBed.resetTestingModule();
  for (const mode of ['success', 'conflict', 'uncertain', 'timeout']) {
    await request('/__test/reset', { method: 'POST', body: JSON.stringify({ mode }) });
    TestBed.configureTestingModule({ providers: [
      { provide: TestComponentRenderer, useValue: { insertRootElement() {}, removeAllRootElements() {} } },
      provideHttpClient(withFetch(), withInterceptors([(req, next) => next(req.clone({ url: base + req.url, setHeaders: { 'x-mock-slug': 'sareevelo' } }))]))
    ] });
    component = TestBed.runInInjectionContext(() => new AppComponent());
    await waitFor(() => !component.loading() && !component.driversLoading());
    assert.equal(component.loadError(), ''); assert.equal(component.driversError(), '');
    assert.equal(component.operationalAlerts()[0].key, 'unassigned');
    component.toggleVisibleSelection(); component.openBulkAssignment();
    await waitFor(() => !component.driversLoading());
    component.bulkDriverId = 8; component.assignSelectedOrders(); component.assignSelectedOrders();
    await waitFor(() => component.bulkFinished() && !component.loading() && !component.driversLoading());
    const state = await request('/__test/state');
    const outcomes = component.bulkResults().map(result => result.outcome);
    assert.deepEqual(outcomes, mode === 'success' ? ['assigned', 'assigned', 'assigned'] : mode === 'conflict' ? ['assigned', 'failed', 'assigned'] : ['assigned', 'unknown', 'skipped']);
    assert.deepEqual(state.calls, mode === 'success' || mode === 'conflict' ? [27, 28, 29] : [27, 28]);
    assert.equal(component.summary().spaces, mode === 'success' ? 0 : 1);
    assert.equal(component.checkedOrders().length, 0);
    console.log(`PASS ${mode}: ${outcomes.join(', ')}; persisted capacity reconciled`);
    component.ngOnDestroy(); component = undefined; TestBed.resetTestingModule();
  }
} finally {
  component?.ngOnDestroy(); TestBed.resetTestingModule(); TestBed.resetTestEnvironment();
  rmSync(output, { recursive: true, force: true });
}
