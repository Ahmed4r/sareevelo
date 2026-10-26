import '@angular/compiler';
import 'zone.js';
import assert from 'node:assert/strict';
import { after, beforeEach, afterEach, test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { TestBed, TestComponentRenderer } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient, withNoXsrfProtection, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

// Compile application sources for Node without adding a second test framework.
const cacheRoot = resolve('.angular');
mkdirSync(cacheRoot, { recursive: true });
const temporary = mkdtempSync(join(cacheRoot, 'order-tests-'));
writeFileSync(join(temporary, 'package.json'), '{"type":"module"}');
const source = resolve('src/app');
function compile(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const input = join(folder, entry.name);
    if (entry.isDirectory()) { compile(input); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    const output = join(temporary, relative(source, input).replace(/\.ts$/, '.js'));
    mkdirSync(dirname(output), { recursive: true });
    const result = ts.transpileModule(readFileSync(input, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, experimentalDecorators: true }
    }).outputText.replace(/from '(\.[^']+)'/g, "from '$1.js'");
    writeFileSync(output, result);
  }
}
compile(source);
const { OrdersStore } = await import(pathToFileURL(join(temporary, 'orders/orders.store.js')));
const { AppComponent } = await import(pathToFileURL(join(temporary, 'app.component.js')));
const { orderErrorMessage } = await import(pathToFileURL(join(temporary, 'orders/order-errors.js')));
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
let store, http, component;
const order = { id: 27, trackingNumber: 'SAR-TEST', customerName: 'Test customer', pickupAddress: 'Passau', deliveryAddress: 'Munich', status: 'PENDING' };
const request = { trackingNumber: order.trackingNumber, customerName: order.customerName, pickupAddress: order.pickupAddress, deliveryAddress: order.deliveryAddress };
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [{ provide: TestComponentRenderer, useValue: { insertRootElement() {}, removeAllRootElements() {} } }, provideHttpClient(withNoXsrfProtection()), provideHttpClientTesting()] });
  store = TestBed.inject(OrdersStore);
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => { component?.ngOnDestroy(); component = undefined; http.verify(); TestBed.resetTestingModule(); });
after(() => { TestBed.resetTestEnvironment(); rmSync(temporary, { recursive: true, force: true }); });

test('loads backend data with numeric IDs and presentation mapping, with no mock orders', () => {
  assert.deepEqual(store.orders(), []);
  store.load(); assert.equal(store.loading(), true);
  http.expectOne('/api/v1/orders').flush([order]);
  assert.equal(store.loading(), false);
  assert.deepEqual(store.orders(), [{ id: 27, trackingNumber: 'SAR-TEST', customer: 'Test customer', pickupAddress: 'Passau', destination: 'Munich', status: 'PENDING' }]);
});
test('loads numeric detail URLs and cancels stale selection requests', () => {
  store.select(27); const stale = http.expectOne('/api/v1/orders/27');
  store.select(28); assert.equal(stale.cancelled, true);
  http.expectOne('/api/v1/orders/28').flush({ ...order, id: 28 });
  assert.equal(store.selected().id, 28);
});
test('POST sends exactly the backend fields and updates the list without reloading', () => {
  store.create(request).subscribe();
  const post = http.expectOne('/api/v1/orders');
  assert.equal(post.request.method, 'POST'); assert.deepEqual(post.request.body, request);
  post.flush(order, { status: 201, statusText: 'Created' });
  assert.equal(store.orders()[0].id, 27); assert.equal(store.selectedId(), 27);
});
test('a stale list response cannot hide a newly created order', () => {
  store.load(); const oldList = http.expectOne('/api/v1/orders');
  store.create(request).subscribe();
  http.expectOne('/api/v1/orders').flush(order);
  assert.equal(oldList.cancelled, true); assert.equal(store.orders().length, 1);
});
test('loading failures expose a retryable error and retry supports empty responses', () => {
  store.load(); http.expectOne('/api/v1/orders').flush('', { status: 502, statusText: 'Bad Gateway' });
  assert.match(store.error(), /Cannot reach/); assert.equal(store.loading(), false);
  store.load(); http.expectOne('/api/v1/orders').flush([]);
  assert.equal(store.error(), ''); assert.deepEqual(store.orders(), []);
});
test('duplicate submit is blocked and failure preserves form values', () => {
  component = TestBed.runInInjectionContext(() => new AppComponent());
  http.expectOne('/api/v1/orders').flush([]);
  component.openNewOrder();
  component.newTrackingNumber.set('SAR-TEST'); component.newCustomer.set('Test customer');
  component.newPickupAddress.set('Passau'); component.newDestination.set('Munich');
  component.createOrder(); component.createOrder();
  const post = http.expectOne('/api/v1/orders');
  post.flush({ message: 'Tracking number already exists.' }, { status: 409, statusText: 'Conflict' });
  assert.equal(component.saving(), false); assert.equal(component.showNewOrder(), true);
  assert.equal(component.newTrackingNumber(), 'SAR-TEST'); assert.match(component.createError(), /already exists/);
  assert.deepEqual(component.orders(), []);
});
test('successful form submission clears filters and makes the created order visible', () => {
  component = TestBed.runInInjectionContext(() => new AppComponent());
  http.expectOne('/api/v1/orders').flush([]);
  component.filter.set('DELIVERED'); component.query.set('unrelated'); component.openNewOrder();
  component.newTrackingNumber.set('SAR-TEST'); component.newCustomer.set('Test customer');
  component.newPickupAddress.set('Passau'); component.newDestination.set('Munich');
  component.createOrder(); http.expectOne('/api/v1/orders').flush(order);
  assert.equal(component.showNewOrder(), false); assert.equal(component.saving(), false);
  assert.equal(component.visibleOrders()[0].trackingNumber, 'SAR-TEST');
  assert.equal(component.currentTab(), 'Deliveries'); assert.equal(component.newTrackingNumber(), '');
});
test('a missing proxy gives an actionable error instead of a generic failure', () => {
  const error = new HttpErrorResponse({ status: 200, error: { text: '<html>' } });
  assert.match(orderErrorMessage(error), /Restart the frontend/);
});
