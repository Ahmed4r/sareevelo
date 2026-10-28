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
const { OrderActivityComponent } = await import(pathToFileURL(join(temporary, 'orders/order-activity.component.js')));
const { OrderViewsComponent } = await import(pathToFileURL(join(temporary, 'orders/order-views.component.js')));
const { BulkAssignmentService } = await import(pathToFileURL(join(temporary, 'orders/bulk-assignment.service.js')));
const { readTheme, ThemeService } = await import(pathToFileURL(join(temporary, 'shared/theme.service.js')));
const { overdue, dueToday, matchesSchedule, localDateTime, windowError } = await import(pathToFileURL(join(temporary, 'orders/order-schedule.js')));
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
let store, http, component;
const order = { id: 27, trackingNumber: 'SAR-TEST', customerName: 'Test customer', pickupAddress: 'Passau', deliveryAddress: 'Munich', status: 'PENDING', driverId: null };
const request = { customerName: order.customerName, pickupAddress: order.pickupAddress, deliveryAddress: order.deliveryAddress };
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
  assert.deepEqual(store.orders(), [{ id: 27, trackingNumber: 'SAR-TEST', customer: 'Test customer', pickupAddress: 'Passau', destination: 'Munich', status: 'PENDING', driverId: null, deliveryWindowStart: null, deliveryWindowEnd: null }]);
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
  http.expectOne('/api/v1/drivers').flush([]);
  http.expectOne('/api/v1/orders').flush([]);
  component.openNewOrder();
  component.newCustomer.set('Test customer');
  component.newPickupAddress.set('Passau'); component.newDestination.set('Munich');
  component.createOrder(); component.createOrder();
  const post = http.expectOne('/api/v1/orders');
  post.flush({ message: 'Tracking number already exists.' }, { status: 409, statusText: 'Conflict' });
  assert.equal(component.saving(), false); assert.equal(component.showNewOrder(), true);
  assert.equal(component.newCustomer(), 'Test customer'); assert.match(component.createError(), /try creating the delivery again/);
  assert.deepEqual(component.orders(), []);
});
test('successful form submission clears filters and makes the created order visible', () => {
  component = TestBed.runInInjectionContext(() => new AppComponent());
  http.expectOne('/api/v1/drivers').flush([]);
  http.expectOne('/api/v1/orders').flush([]);
  component.filter.set('DELIVERED'); component.query.set('unrelated'); component.openNewOrder();
  component.newCustomer.set('Test customer');
  component.newPickupAddress.set('Passau'); component.newDestination.set('Munich');
  component.createOrder(); http.expectOne('/api/v1/orders').flush(order);
  assert.equal(component.showNewOrder(), false); assert.equal(component.saving(), false);
  assert.equal(component.visibleOrders()[0].trackingNumber, 'SAR-TEST');
  assert.equal(component.currentTab(), 'Deliveries'); assert.equal(component.newCustomer(), ''); assert.equal(component.selectedOrder().trackingNumber, 'SAR-TEST'); assert.match(component.toast(), /SAR-TEST/);
});
test('a missing proxy gives an actionable error instead of a generic failure', () => {
  const error = new HttpErrorResponse({ status: 200, error: { text: '<html>' } });
  assert.match(orderErrorMessage(error), /Restart the frontend/);
});

test('a stale backend explains unsupported edits and preserves the date draft', () => {
  startComponent();
  component.selectOrder(order.id); http.expectOne('/api/v1/orders/27').flush(order);
  component.editOrder();
  component.deliveryWindowStart = '2026-11-02T10:00';
  component.deliveryWindowEnd = '2026-11-02T12:00';
  component.createOrder();
  http.expectOne('/api/v1/orders/27').flush({status:405}, {status:405, statusText:'Method Not Allowed'});
  assert.match(component.createError(), /Restart the backend/);
  assert.equal(component.deliveryWindowEnd, '2026-11-02T12:00');
  assert.equal(component.showNewOrder(), true);
});

const driver = { id: 8, name: 'Alex', employeeCode: 'TEST-8', status: 'AVAILABLE', capacity: 2, availableSpaces: 2 };
function startComponent() {
  component = TestBed.runInInjectionContext(() => new AppComponent());
  http.expectOne('/api/v1/orders').flush([order]);
  http.expectOne('/api/v1/drivers').flush([driver]);
}

test('alternate views preserve filtered order selection and use the existing detail request', () => {
  startComponent();
  component.toggleOrderSelection(order.id);
  component.query.set('Munich');
  component.orderView.set('board');
  const views = new OrderViewsComponent();
  views.orders = component.visibleOrders(); views.mode = 'board';
  views.checked = component.checkedOrderIds();
  assert.equal(views.groups.find(group => group.key === 'PENDING').orders[0].id, order.id);
  assert.equal(views.checked.has(order.id), true);
  assert.equal(views.groups.reduce((sum, group) => sum + group.orders.length, 0), 1);
  const subscription = views.open.subscribe(id => component.selectOrder(id));
  views.open.emit(order.id);
  http.expectOne('/api/v1/orders/27').flush(order);
  assert.equal(component.selectedOrder().trackingNumber, order.trackingNumber);
  component.orderView.set('cards');
  assert.equal(component.checkedOrders().length, 1);
  component.query.set('No match');
  views.orders = component.visibleOrders();
  assert.equal(views.groups.every(group => group.orders.length === 0), true);
  assert.equal(component.hiddenCheckedCount(), 1);
  subscription.unsubscribe();
});

test('board keeps terminal records distinct and only flags unfinished deadlines', () => {
  const views = new OrderViewsComponent();
  views.mode = 'board'; views.now = Date.now();
  views.orders = ['PENDING', 'IN_TRANSIT', 'DELAYED', 'DELIVERED', 'CANCELLED'].map((status, id) => ({
    id, trackingNumber: 'SAR-' + id, customer: 'Customer', pickupAddress: 'A', destination: 'B',
    status, driverId: null, deliveryWindowStart: '2020-01-01T10:00:00Z', deliveryWindowEnd: '2020-01-01T11:00:00Z'
  }));
  assert.deepEqual(views.groups.map(group => group.orders.length), [1, 1, 1, 1, 1]);
  assert.deepEqual(views.orders.map(item => views.isLate(item)), [true, true, true, false, false]);
  assert.deepEqual(views.orders.map(item => views.eligible(item)), [true, false, false, false, false]);
  views.driverNames = new Map([[8, 'Alex']]);
  assert.equal(views.driverName(8), 'Alex');
  assert.equal(views.driverName(9), 'Driver #9');
});

test('schedule filters use local deadlines and exclude finished and unscheduled records', () => {
  const now = new Date(2026, 9, 28, 12).getTime();
  const end = new Date(2026, 9, 28, 11).toISOString();
  const scheduled = { ...order, deliveryWindowEnd: end };
  assert.equal(overdue(scheduled, now), true); assert.equal(dueToday(scheduled, now), true);
  assert.equal(overdue(scheduled, Date.parse(end)), false);
  assert.equal(dueToday({ ...scheduled, deliveryWindowEnd: new Date(2026, 9, 29, 0).toISOString() }, now), false);
  for (const status of ['DELIVERED', 'CANCELLED']) {
    assert.equal(overdue({ ...scheduled, status }, now), false); assert.equal(dueToday({ ...scheduled, status }, now), false);
  }
  assert.equal(overdue(order, now), false); assert.equal(matchesSchedule(order, 'UNSCHEDULED', now), true);
  assert.equal(matchesSchedule({ ...order, status: 'CANCELLED' }, 'UNSCHEDULED', now), false);
  assert.equal(windowError('', ''), ''); assert.match(windowError('2026-10-28T10:00', ''), /both/);
  assert.match(windowError('2026-10-28T12:00', '2026-10-28T10:00'), /end after/);
  assert.match(windowError('invalid', 'invalid'), /valid/);
  assert.equal(windowError('2026-10-28T10:00', '2026-10-28T12:00'), '');
});

test('overdue alerts update from clock changes without changing manually reported status', () => {
  startComponent(); const end = Date.now() + 60000;
  component.reloadOrders(); http.expectOne('/api/v1/orders').flush([{ ...order, deliveryWindowStart: new Date(end - 3600000).toISOString(), deliveryWindowEnd: new Date(end).toISOString() }]);
  component.clockNow.set(end - 1); assert.equal(component.operationalAlerts().some(alert => alert.key === 'overdue'), false);
  component.clockNow.set(end + 1); assert.equal(component.operationalAlerts()[0].key, 'overdue');
  assert.equal(component.orders()[0].status, 'PENDING');
  component.openOperationalAlert('overdue'); component.clockNow.set(end + 1);
  assert.equal(component.currentTab(), 'Deliveries'); assert.equal(component.scheduleFilter(), 'OVERDUE'); assert.equal(component.visibleOrders().length, 1);
  component.clearFilters(); assert.equal(component.scheduleFilter(), 'ALL');
});

test('scheduled creation validates before POST and sends timezone-aware instants', () => {
  startComponent(); component.openNewOrder(); component.newCustomer.set('Scheduled'); component.newPickupAddress.set('Pickup'); component.newDestination.set('Delivery');
  component.deliveryWindowStart = '2026-11-02T10:00'; component.createOrder();
  assert.match(component.scheduleError(), /both/); http.expectNone('/api/v1/orders');
  component.deliveryWindowEnd = '2026-11-02T12:00'; component.createOrder();
  const post = http.expectOne('/api/v1/orders');
  assert.equal(post.request.body.deliveryWindowStart, new Date('2026-11-02T10:00').toISOString());
  assert.equal(post.request.body.deliveryWindowEnd, new Date('2026-11-02T12:00').toISOString());
  post.flush({ ...order, ...post.request.body });
  assert.equal(component.deliveryWindowStart, ''); assert.equal(component.showNewOrder(), false);
});

test('pending edits retain tracking, clear schedule explicitly, and preserve form values on conflict', () => {
  startComponent(); component.selectOrder(27);
  const scheduled = { ...order, deliveryWindowStart: '2026-11-02T09:00:00Z', deliveryWindowEnd: '2026-11-02T11:00:00Z' };
  http.expectOne('/api/v1/orders/27').flush(scheduled); component.editOrder();
  assert.equal(component.deliveryWindowStart, localDateTime(scheduled.deliveryWindowStart)); assert.equal(component.editingTracking(), 'SAR-TEST');
  component.newDestination.set('Updated address'); component.deliveryWindowStart = ''; component.deliveryWindowEnd = '';
  component.createOrder(); component.createOrder();
  const put = http.expectOne('/api/v1/orders/27'); assert.equal(put.request.method, 'PUT');
  assert.deepEqual(put.request.body, { customerName: order.customerName, pickupAddress: order.pickupAddress, deliveryAddress: 'Updated address', deliveryWindowStart: null, deliveryWindowEnd: null });
  put.flush({ message: 'Only pending orders can be edited' }, { status: 409, statusText: 'Conflict' });
  http.expectOne('/api/v1/orders').flush([order]); http.expectOne('/api/v1/drivers').flush([driver]); http.expectOne('/api/v1/orders/27').flush(order);
  assert.equal(component.newDestination(), 'Updated address'); assert.equal(component.showNewOrder(), true); assert.match(component.createError(), /Only pending/);
  component.createOrder(); http.expectOne('/api/v1/orders/27').flush({ ...order, deliveryAddress: 'Updated address', deliveryWindowStart: null, deliveryWindowEnd: null });
  assert.equal(component.selectedOrder().trackingNumber, 'SAR-TEST'); assert.equal(component.selectedOrder().destination, 'Updated address');
  assert.equal(component.showNewOrder(), false); assert.match(component.toast(), /updated/);
});

test('cancellation requires confirmation, prevents duplicate requests and refreshes released capacity', () => {
  startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush({ ...order, driverId: 8 });
  component.confirmCancellation(); http.expectNone('/api/v1/orders/27/status');
  component.requestCancellation(); component.confirmCancellation(); component.confirmCancellation(); component.closeCancellation();
  assert.notEqual(component.cancelOrderTarget(), null);
  const patch = http.expectOne('/api/v1/orders/27/status'); assert.deepEqual(patch.request.body, { status: 'CANCELLED' });
  const cancelled = { ...order, driverId: 8, status: 'CANCELLED' }; patch.flush(cancelled);
  http.expectOne('/api/v1/orders').flush([cancelled]); http.expectOne('/api/v1/orders/27').flush(cancelled); http.expectOne('/api/v1/drivers').flush([driver]);
  assert.equal(component.cancelling(), false); assert.equal(component.cancelOrderTarget(), null); assert.equal(component.selectedOrder().status, 'CANCELLED');
  component.requestCancellation(); assert.equal(component.cancelOrderTarget(), null);
  component.editOrder(); assert.equal(component.showNewOrder(), false); assert.equal(component.eligibleOrders().length, 0);
});

test('cancellation conflict retains the dialog and reconciles the selected order', () => {
  startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush({ ...order, driverId: 8 });
  component.requestCancellation(); component.confirmCancellation();
  http.expectOne('/api/v1/orders/27/status').flush({ message: 'Completed deliveries cannot be cancelled' }, { status: 409, statusText: 'Conflict' });
  const delivered = { ...order, driverId: 8, status: 'DELIVERED' };
  http.expectOne('/api/v1/orders').flush([delivered]); http.expectOne('/api/v1/orders/27').flush(delivered); http.expectOne('/api/v1/drivers').flush([driver]);
  assert.match(component.cancelError(), /Completed/); assert.notEqual(component.cancelOrderTarget(), null); assert.equal(component.cancelling(), false);
  component.closeCancellation(); component.requestCancellation(); assert.equal(component.cancelOrderTarget(), null);
});

test('driver creation requires a valid phone and rejects malformed profile fields', () => {
  startComponent(); component.openNewDriver(); component.driverName = 'Alex'; component.employeeCode = 'TEST-8';
  component.createDriver(); assert.match(component.driverCreateError(), /mobile number/); http.expectNone('/api/v1/drivers');
  component.mobileNumber = 'call me'; component.createDriver(); http.expectNone('/api/v1/drivers');
  component.mobileNumber = '+4915123456789'; component.driverEmail = 'bad email'; component.createDriver();
  assert.match(component.driverCreateError(), /email/); http.expectNone('/api/v1/drivers');
});

test('driver profile editing preserves operational fields, entered values on error, and updates the roster', () => {
  startComponent(); component.selectDriver(8); http.expectOne('/api/v1/drivers/8').flush(driver);
  component.editDriverProfile(); assert.equal(component.editingDriverId(), 8); assert.equal(component.mobileNumber, '');
  component.driverName = ' Alex Updated '; component.mobileNumber = '+49 (151) 234-56789';
  component.driverEmail = ' alex@example.com '; component.vehicleType = 'VAN'; component.vehicleRegistration = ' AB 123 '; component.driverNotes = ' Call before pickup ';
  component.createDriver(); component.createDriver();
  const put = http.expectOne('/api/v1/drivers/8/profile'); assert.equal(put.request.method, 'PUT');
  const profile = { name: 'Alex Updated', mobileNumber: '+4915123456789', email: 'alex@example.com', vehicleType: 'VAN', vehicleRegistration: 'AB 123', notes: 'Call before pickup' };
  assert.deepEqual(put.request.body, profile);
  put.flush({ message: 'Please check the profile' }, { status: 400, statusText: 'Bad Request' });
  assert.equal(component.showNewDriver(), true); assert.equal(component.vehicleRegistration, ' AB 123 ');
  component.currentTab.set('Fleet'); component.createDriver();
  const updated = { ...driver, ...profile };
  http.expectOne('/api/v1/drivers/8/profile').flush(updated); http.expectOne('/api/v1/drivers').flush([updated]);
  assert.equal(component.showNewDriver(), false); assert.equal(component.selectedDriver().email, 'alex@example.com');
  assert.equal(component.selectedDriver().capacity, 2);
  component.driverQuery.set('alex@example'); assert.equal(component.visibleDrivers().length, 1);
  component.openNewDriver(); assert.equal(component.mobileNumber, ''); assert.equal(component.editingDriverId(), null);
});

test('legacy profiles accept missing contact values and clear optional fields explicitly', () => {
  startComponent(); component.selectDriver(8); http.expectOne('/api/v1/drivers/8').flush(driver);
  component.editDriverProfile(); component.createDriver();
  const put = http.expectOne('/api/v1/drivers/8/profile');
  assert.deepEqual(put.request.body, { name: 'Alex', mobileNumber: null, email: null, vehicleType: null, vehicleRegistration: null, notes: null });
  put.flush(driver); http.expectOne('/api/v1/drivers').flush([driver]);
});

test('theme defaults to light, reads saved dark preference and tolerates unavailable storage', () => {
  assert.equal(readTheme(), 'light'); assert.equal(readTheme({ getItem: () => 'dark' }), 'dark');
  assert.equal(readTheme({ getItem: () => 'invalid' }), 'light');
  assert.equal(readTheme({ getItem: () => { throw new Error('Storage blocked'); } }), 'light');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); const data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) } });
  try {
    const theme = new ThemeService(); assert.equal(theme.current(), 'light'); theme.toggle();
    assert.equal(data.get('sareevelo-theme'), 'dark'); assert.equal(new ThemeService().current(), 'dark'); theme.toggle();
    assert.equal(data.get('sareevelo-theme'), 'light');
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});

test('operational alerts distinguish delays, pending assignments and real capacity shortage', () => {
  startComponent(); component.reloadOrders();
  http.expectOne('/api/v1/orders').flush([order, { ...order, id: 28 }, { ...order, id: 29 }, { ...order, id: 30, status: 'DELAYED', driverId: 8 }]);
  assert.deepEqual(component.operationalAlerts().map(alert => alert.key), ['delayed', 'unassigned', 'capacity']);
  assert.match(component.operationalAlerts()[2].title, /1 orders exceed/);
  component.query.set('unrelated'); component.unassignedOnly.set(true); component.openOperationalAlert('delayed');
  assert.equal(component.currentTab(), 'Deliveries'); assert.equal(component.query(), '');
  assert.deepEqual(component.visibleOrders().map(order => order.id), [30]);
  component.openOperationalAlert('unassigned'); assert.equal(component.visibleOrders().length, 3);
  component.reloadDrivers(); assert.equal(component.operationalAlerts().some(alert => alert.key === 'capacity'), false);
  http.expectOne('/api/v1/drivers').flush('', { status: 502, statusText: 'Bad Gateway' });
  assert.equal(component.operationalAlerts().some(alert => alert.key === 'capacity'), false);
  component.reloadOrders(); assert.deepEqual(component.operationalAlerts(), []);
  http.expectOne('/api/v1/orders').flush('', { status: 502, statusText: 'Bad Gateway' });
  assert.deepEqual(component.operationalAlerts(), []);
});

test('selection includes only eligible orders and reports hidden selections', () => {
  startComponent(); component.reloadOrders();
  http.expectOne('/api/v1/orders').flush([order, { ...order, id: 28, trackingNumber: 'SECOND' }, { ...order, id: 29, driverId: 8 }, { ...order, id: 30, status: 'DELIVERED' }]);
  component.toggleOrderSelection(29); component.toggleOrderSelection(30); assert.equal(component.checkedOrders().length, 0);
  component.toggleOrderSelection(27); assert.equal(component.someVisibleChecked(), true);
  component.query.set('SECOND'); assert.equal(component.hiddenCheckedCount(), 1);
  component.toggleVisibleSelection(); assert.equal(component.checkedOrders().length, 2); assert.equal(component.allVisibleChecked(), true);
  component.toggleVisibleSelection(); assert.equal(component.checkedOrders().length, 1);
  component.clearOrderSelection(); assert.equal(component.checkedOrders().length, 0);
});

test('bulk assignment validates current capacity and order eligibility before sending', () => {
  startComponent(); component.toggleOrderSelection(27); component.openBulkAssignment();
  component.bulkDriverId = 8; component.assignSelectedOrders(); http.expectNone('/api/v1/orders/27/assign');
  http.expectOne('/api/v1/drivers').flush([{ ...driver, availableSpaces: 0 }]);
  component.assignSelectedOrders(); assert.match(component.bulkError(), /enough free spaces/);
  component.reloadDrivers(); http.expectOne('/api/v1/drivers').flush([driver]);
  component.reloadOrders(); http.expectOne('/api/v1/orders').flush([{ ...order, driverId: 8 }]);
  component.assignSelectedOrders(); assert.match(component.bulkError(), /no longer eligible/);
  http.expectNone('/api/v1/orders/27/assign');
});

test('bulk assignment sends sequential numeric requests, blocks duplicates and reconciles results', () => {
  startComponent(); component.reloadOrders();
  const second = { ...order, id: 28, trackingNumber: 'SECOND' };
  http.expectOne('/api/v1/orders').flush([order, second]);
  component.toggleVisibleSelection(); component.openBulkAssignment(); http.expectOne('/api/v1/drivers').flush([driver]);
  component.bulkDriverId = 8; component.assignSelectedOrders(); component.assignSelectedOrders(); component.closeBulkAssignment();
  assert.equal(component.showBulkAssignment(), true);
  const first = http.expectOne('/api/v1/orders/27/assign'); assert.deepEqual(first.request.body, { driverId: 8 });
  http.expectNone('/api/v1/orders/28/assign'); first.flush({ ...order, driverId: 8 });
  assert.equal(component.bulkAssigning(), true);
  http.expectOne('/api/v1/orders/28/assign').flush({ ...second, driverId: 8 });
  assert.equal(component.bulkFinished(), true); assert.equal(component.bulkSuccessCount(), 2);
  assert.equal(component.checkedOrders().length, 0);
  http.expectOne('/api/v1/orders').flush([{ ...order, driverId: 8 }, { ...second, driverId: 8 }]);
  http.expectOne('/api/v1/drivers').flush([{ ...driver, availableSpaces: 0 }]);
  component.assignSelectedOrders(); http.expectNone('/api/v1/orders/27/assign');
});

test('bulk service retains per-order conflicts and continues other eligible orders', () => {
  const service = TestBed.inject(BulkAssignmentService); const results = [];
  service.assign([{ id: 27, trackingNumber: 'FIRST' }, { id: 28, trackingNumber: 'SECOND' }], 8).subscribe(result => results.push(result));
  http.expectOne('/api/v1/orders/27/assign').flush({ message: 'Order already assigned' }, { status: 409, statusText: 'Conflict' });
  http.expectOne('/api/v1/orders/28/assign').flush({ ...order, id: 28, driverId: 8 });
  assert.deepEqual(results.map(result => result.outcome), ['failed', 'assigned']);
  assert.match(results[0].message, /already assigned/);
});

test('uncertain response stops the batch without retries or misleading failure claims', () => {
  const service = TestBed.inject(BulkAssignmentService); const results = [];
  service.assign([{ id: 27, trackingNumber: 'FIRST' }, { id: 28, trackingNumber: 'SECOND' }, { id: 29, trackingNumber: 'THIRD' }], 8).subscribe(result => results.push(result));
  http.expectOne('/api/v1/orders/27/assign').flush({ ...order, driverId: 8 });
  http.expectOne('/api/v1/orders/28/assign').flush('<html>Proxy error</html>', { status: 502, statusText: 'Bad Gateway' });
  http.expectNone('/api/v1/orders/29/assign'); http.expectNone('/api/v1/orders/28/assign');
  assert.deepEqual(results.map(result => result.outcome), ['assigned', 'unknown', 'skipped']);
  assert.match(results[1].message, /may have been saved/);
});

test('destroying a running bulk assignment cancels requests and queued work', () => {
  startComponent(); component.toggleOrderSelection(27); component.openBulkAssignment(); http.expectOne('/api/v1/drivers').flush([driver]);
  component.bulkDriverId = 8; component.assignSelectedOrders(); const pending = http.expectOne('/api/v1/orders/27/assign');
  component.ngOnDestroy(); assert.equal(pending.cancelled, true); assert.equal(component.bulkFinished(), false);
});

test('driver creation validates capacity, blocks duplicate submits and refreshes the roster', () => {
  startComponent(); component.showNewDriver.set(true);
  component.driverName = ' Alex '; component.employeeCode = ' TEST-8 '; component.driverCapacity = 1.5; component.mobileNumber = '+49 151 23456789';
  component.createDriver(); http.expectNone('/api/v1/drivers');
  assert.match(component.driverCreateError(), /whole-number/);
  component.driverCapacity = 2; component.createDriver(); component.createDriver();
  const post = http.expectOne('/api/v1/drivers');
  assert.equal(post.request.method, 'POST');
  assert.deepEqual(post.request.body, { name: 'Alex', employeeCode: 'TEST-8', capacity: 2, mobileNumber: '+4915123456789', email: null, vehicleType: null, vehicleRegistration: null, notes: null });
  post.flush(driver, { status: 201, statusText: 'Created' });
  http.expectOne('/api/v1/drivers').flush([driver]);
  assert.equal(component.showNewDriver(), false); assert.equal(component.drivers()[0].id, 8);
});

test('driver conflict preserves entered values and a failed roster can be retried', () => {
  startComponent(); component.showNewDriver.set(true);
  component.driverName = 'Alex'; component.employeeCode = 'TEST-8'; component.mobileNumber = '+4915123456789';
  component.createDriver();
  http.expectOne('/api/v1/drivers').flush({ message: 'Employee code already exists' }, { status: 409, statusText: 'Conflict' });
  assert.equal(component.employeeCode, 'TEST-8'); assert.equal(component.showNewDriver(), true);
  assert.match(component.driverCreateError(), /already exists/);
  component.reloadDrivers(); http.expectOne('/api/v1/drivers').flush('', { status: 502, statusText: 'Bad Gateway' });
  assert.equal(component.driversLoading(), false); assert.match(component.driversError(), /Cannot reach/);
  component.reloadDrivers(); http.expectOne('/api/v1/drivers').flush([]);
  assert.equal(component.driversError(), ''); assert.deepEqual(component.drivers(), []);
});

test('assignment posts numeric IDs, prevents duplicate submission and refreshes orders, details and capacity', () => {
  startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush(order);
  component.assignmentDriverId = 8; component.assignDriver(); component.assignDriver();
  const post = http.expectOne('/api/v1/orders/27/assign');
  assert.equal(post.request.method, 'POST'); assert.deepEqual(post.request.body, { driverId: 8 });
  const assigned = { ...order, driverId: 8 };
  post.flush(assigned);
  http.expectOne('/api/v1/orders').flush([assigned]);
  http.expectOne('/api/v1/orders/27').flush(assigned);
  http.expectOne('/api/v1/drivers').flush([{ ...driver, status: 'ON_DELIVERY', availableSpaces: 1 }]);
  assert.equal(component.selectedOrder().driverId, 8); assert.equal(component.orders()[0].driverId, 8);
  assert.equal(component.availableDrivers()[0].availableSpaces, 1); assert.equal(component.driverLabel(8), 'Alex');
  component.assignmentDriverId = 8; component.assignDriver(); http.expectNone('/api/v1/orders/27/assign');
});

for (const status of [404, 409]) {
  test(`assignment ${status} refreshes stale order and driver data and leaves an actionable error`, () => {
    startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush(order);
    component.assignmentDriverId = 8; component.assignDriver();
    http.expectOne('/api/v1/orders/27/assign').flush({ message: 'Driver unavailable' }, { status, statusText: 'Conflict' });
    http.expectOne('/api/v1/orders').flush([order]); http.expectOne('/api/v1/orders/27').flush(order);
    http.expectOne('/api/v1/drivers').flush([{ ...driver, availableSpaces: 0 }]);
    assert.ok(component.assignError()); assert.equal(component.assigning(), false);
    assert.equal(component.assignmentDriverId, null); assert.deepEqual(component.availableDrivers(), []);
  });
}

test('driver details use numeric endpoints, cancel stale selections and expose related persisted orders', () => {
  startComponent();
  component.selectDriver(8); const stale = http.expectOne('/api/v1/drivers/8');
  component.selectDriver(9); assert.equal(stale.cancelled, true);
  http.expectOne('/api/v1/drivers/9').flush({ ...driver, id: 9, name: 'Sam' });
  assert.equal(component.selectedDriver().name, 'Sam'); assert.equal(component.driverDetailLoading(), false);
  assert.deepEqual(component.driverOrders(), []);
  component.reloadOrders(); http.expectOne('/api/v1/orders').flush([{ ...order, driverId: 9 }]);
  assert.equal(component.driverOrders()[0].id, 27);
  component.closeDriverDetails(); assert.equal(component.selectedDriver(), null);
});

test('missing driver details show an error and can be retried', () => {
  startComponent(); component.selectDriver(8);
  http.expectOne('/api/v1/drivers/8').flush({}, { status: 404, statusText: 'Not Found' });
  assert.match(component.driverDetailError(), /no longer exists/);
  assert.equal(component.driverDetailLoading(), false);
  component.selectDriver(8); http.expectOne('/api/v1/drivers/8').flush(driver);
  assert.equal(component.driverDetailError(), ''); assert.equal(component.selectedDriver().id, 8);
});

test('dispatch counts and unassigned filter distinguish pending assigned orders', () => {
  startComponent(); component.reloadOrders();
  http.expectOne('/api/v1/orders').flush([order, { ...order, id: 28, driverId: 8 }, { ...order, id: 29, status: 'DELIVERED' }]);
  assert.equal(component.summary().unassigned, 1); assert.equal(component.summary().assigned, 1);
  assert.equal(component.summary().spaces, 2);
  component.showUnassigned(); assert.deepEqual(component.visibleOrders().map(item => item.id), [27]);
  component.setFilter('PENDING'); assert.equal(component.visibleOrders().length, 2);
  component.clearFilters(); assert.equal(component.visibleOrders().length, 3);
});

test('driver search and status filter use only fetched records', () => {
  startComponent(); component.reloadDrivers();
  http.expectOne('/api/v1/drivers').flush([driver, { ...driver, id: 9, name: 'Sam', employeeCode: 'OFF-9', status: 'OFFLINE' }]);
  component.driverQuery.set('off-9'); assert.equal(component.visibleDrivers()[0].id, 9);
  component.driverFilter.set('AVAILABLE'); assert.deepEqual(component.visibleDrivers(), []);
  component.driverQuery.set(''); assert.equal(component.visibleDrivers()[0].id, 8);
});

test('delivery completion blocks duplicate submits and refreshes status and released capacity', () => {
  startComponent(); component.selectOrder(27);
  http.expectOne('/api/v1/orders/27').flush({ ...order, driverId: 8, status: 'IN_TRANSIT' });
  component.updateOrderStatus('DELIVERED'); component.updateOrderStatus('DELIVERED');
  const patch = http.expectOne('/api/v1/orders/27/status');
  assert.equal(patch.request.method, 'PATCH'); assert.deepEqual(patch.request.body, { status: 'DELIVERED' });
  const completed = { ...order, driverId: 8, status: 'DELIVERED' };
  patch.flush(completed);
  http.expectOne('/api/v1/orders').flush([completed]);
  http.expectOne('/api/v1/orders/27').flush(completed);
  http.expectOne('/api/v1/drivers').flush([driver]);
  assert.equal(component.statusChanging(), false); assert.equal(component.selectedOrder().status, 'DELIVERED');
  assert.equal(component.drivers()[0].availableSpaces, 2);
});

test('status conflict refreshes stale records and leaves an actionable message', () => {
  startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush(order);
  component.updateOrderStatus('IN_TRANSIT');
  http.expectOne('/api/v1/orders/27/status').flush({ message: 'Assign a driver first' }, { status: 409, statusText: 'Conflict' });
  http.expectOne('/api/v1/orders').flush([order]); http.expectOne('/api/v1/orders/27').flush(order);
  http.expectOne('/api/v1/drivers').flush([driver]);
  assert.equal(component.statusChanging(), false); assert.match(component.statusError(), /Assign a driver/);
});

test('status response does not replace a different selected order', () => {
  startComponent(); component.selectOrder(27); http.expectOne('/api/v1/orders/27').flush({ ...order, driverId: 8 });
  component.updateOrderStatus('IN_TRANSIT'); const patch = http.expectOne('/api/v1/orders/27/status');
  component.selectOrder(28); http.expectOne('/api/v1/orders/28').flush({ ...order, id: 28 });
  patch.flush({ ...order, driverId: 8, status: 'IN_TRANSIT' });
  http.expectOne('/api/v1/orders').flush([{ ...order, id: 28 }]); http.expectOne('/api/v1/drivers').flush([driver]);
  assert.equal(component.selectedOrder().id, 28);
});

test('activity loads persisted events, cancels stale selections and retries failures', () => {
  const history = TestBed.runInInjectionContext(() => new OrderActivityComponent());
  history.orderId = 27; history.ngOnChanges(); const stale = http.expectOne('/api/v1/orders/27/activity');
  history.orderId = 28; history.ngOnChanges(); assert.equal(stale.cancelled, true);
  http.expectOne('/api/v1/orders/28/activity').flush('', { status: 502, statusText: 'Bad Gateway' });
  assert.match(history.error(), /Cannot reach/); assert.equal(history.loading(), false);
  history.load(); const events = [{ id: 1, orderId: 28, type: 'DELIVERY_STARTED', message: 'Delivery started', timestamp: '2026-10-27T12:00:00Z' }];
  http.expectOne('/api/v1/orders/28/activity').flush(events);
  assert.deepEqual(history.events(), events); assert.equal(history.error(), '');
  history.load(); http.expectOne('/api/v1/orders/28/activity').flush([]);
  assert.deepEqual(history.events(), []); history.ngOnDestroy();
});
