// Local test fixture derived from OrderService.assignDriver and the public DTOs.
// Test-only controls and records never enter the application's production config.
const http = require('http');
const key = 'sareevelo-assignment:state';
function seed(mode = 'success') {
  return { mode, calls: [], orders: [27, 28, 29].map(id => ({ id, trackingNumber: `SIM-${id}`, customerName: 'Simulation customer', pickupAddress: 'Pickup', deliveryAddress: 'Destination', status: 'PENDING', driverId: null })),
    drivers: [{ id: 8, name: 'Simulation driver', employeeCode: 'SIM-8', capacity: 3, availableSpaces: 3, status: 'AVAILABLE', mobileNumber: null, email: null, vehicleType: null, vehicleRegistration: null, notes: null }] };
}
http.createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const state = (await pm.state.get(key)) || seed();
  const path = req.url.split('?')[0];
  if (req.method === 'POST' && path === '/__test/reset') { await pm.state.set(key, seed(req.body.mode)); return send(200, { reset: true }); }
  if (req.method === 'GET' && path === '/__test/state') return send(200, state);
  if (req.method === 'GET' && path === '/api/v1/orders') return send(200, state.orders);
  if (req.method === 'POST' && path === '/api/v1/orders') {
    const body = req.body;
    if (['customerName', 'pickupAddress', 'deliveryAddress'].some(field => typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > (field === 'customerName' ? 150 : 255))) return send(400, { message: 'Check customer and addresses' });
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const generated = 'SAR-' + Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[require('crypto').randomInt(alphabet.length)]).join('')).join('-');
    const trackingNumber = body.trackingNumber?.trim() || generated;
    if (state.orders.some(order => order.trackingNumber === trackingNumber)) return send(409, { message: 'Tracking number already exists' });
    const order = { id: Math.max(...state.orders.map(item => item.id)) + 1, trackingNumber, customerName: body.customerName.trim(), pickupAddress: body.pickupAddress.trim(), deliveryAddress: body.deliveryAddress.trim(), status: 'PENDING', driverId: null };
    state.orders.push(order); state.lastOrderCreate = body; await pm.state.set(key, state); return send(201, order);
  }
  const orderDetail = path.match(/^\/api\/v1\/orders\/(\d+)$/);
  if (req.method === 'GET' && orderDetail) {
    const order = state.orders.find(item => item.id === Number(orderDetail[1]));
    return order ? send(200, order) : send(404, { message: 'Order not found' });
  }
  if (req.method === 'GET' && path === '/api/v1/drivers') return send(200, state.drivers);
  const detail = path.match(/^\/api\/v1\/drivers\/(\d+)$/);
  if (req.method === 'GET' && detail) {
    const driver = state.drivers.find(item => item.id === Number(detail[1]));
    return driver ? send(200, driver) : send(404, { message: 'Driver not found' });
  }
  const profilePath = path.match(/^\/api\/v1\/drivers\/(\d+)\/profile$/);
  if ((req.method === 'PUT' && profilePath) || (req.method === 'POST' && path === '/api/v1/drivers')) {
    const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null;
    const body = req.body;
    const profile = { name: clean(body.name), mobileNumber: clean(body.mobileNumber)?.replace(/[\s().-]/g, '') || null,
      email: clean(body.email), vehicleType: clean(body.vehicleType), vehicleRegistration: clean(body.vehicleRegistration), notes: clean(body.notes) };
    const create = req.method === 'POST';
    if (!profile.name || profile.name.length > 150 || (create && !profile.mobileNumber) || (profile.mobileNumber && !/^\+?[0-9]{7,15}$/.test(profile.mobileNumber)) ||
        (profile.email && (!/^[^\s@]+@[^\s@]+$/.test(profile.email) || profile.email.length > 254)) ||
        (profile.vehicleType && !['BICYCLE','MOTORCYCLE','CAR','VAN','TRUCK','OTHER'].includes(profile.vehicleType)) ||
        (profile.vehicleRegistration?.length ?? 0) > 32 || (profile.notes?.length ?? 0) > 1000) return send(400, { message: 'Check profile fields' });
    if (create) {
      if (!clean(body.employeeCode) || body.employeeCode.trim().length > 50 || !Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 2147483647) return send(400, { message: 'Invalid employee code or capacity' });
      if (state.drivers.some(driver => driver.employeeCode === body.employeeCode.trim())) return send(409, { message: 'Employee code already exists' });
      const driver = { ...profile, id: Math.max(...state.drivers.map(item => item.id)) + 1, employeeCode: body.employeeCode.trim(), capacity: body.capacity, availableSpaces: body.capacity, status: 'AVAILABLE' };
      state.drivers.push(driver); await pm.state.set(key, state); return send(201, driver);
    }
    const driver = state.drivers.find(item => item.id === Number(profilePath[1]));
    if (!driver) return send(404, { message: 'Driver not found' });
    Object.assign(driver, profile); await pm.state.set(key, state); return send(200, driver);
  }
  const assignment = path.match(/^\/api\/v1\/orders\/(\d+)\/assign$/);
  if (req.method === 'POST' && assignment) {
    const id = Number(assignment[1]); state.calls.push(id);
    const order = state.orders.find(order => order.id === id);
    const driver = state.drivers.find(driver => driver.id === req.body.driverId);
    if (!Number.isInteger(req.body.driverId)) return send(400, { message: 'driverId must be a numeric ID' });
    if (!order || !driver) return send(404, { message: 'Order or driver not found' });
    if (order.driverId !== null || order.status !== 'PENDING' || driver.status === 'OFFLINE' || driver.availableSpaces <= 0) return send(409, { message: 'Order or driver is unavailable' });
    if (state.mode === 'conflict' && id === 28) { await pm.state.set(key, state); return send(409, { message: 'Order already assigned by another dispatcher' }); }
    order.driverId = driver.id; driver.availableSpaces--; driver.status = 'ON_DELIVERY';
    await pm.state.set(key, state);
    // Simulate a response lost after commit: the caller must not blindly retry.
    if (state.mode === 'uncertain' && id === 28) { res.writeHead(502, { 'Content-Type': 'text/html' }); return res.end('<html>Gateway error after commit</html>'); }
    if (state.mode === 'timeout' && id === 28) { setTimeout(() => send(200, order), 21000); return; }
    return send(200, order);
  }
  return send(501, { message: 'Not modeled by the assignment simulation' });
}).listen(process.env.PORT || 4500);
