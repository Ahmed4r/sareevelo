const fs = require('node:fs');
const path = 'src/app/app.component.html';
let html = fs.readFileSync(path, 'utf8');
function replace(from, to) { if (!html.includes(from)) throw Error(`Missing target: ${from}`); html = html.replace(from, to); }
const image = (name, kind = '') => `<img class="workspace-illustration ${kind}" src="illustrations/${name}.png" width="1536" height="1024" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
replace('<span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5H9a4 4 0 0 0 0 8h6a3 3 0 0 1 0 6H5"/></svg></span>', '<img class="brand-mark" src="brand/sareevelo-mark.svg" width="32" height="32" alt="">');
replace('<span class="empty-icon"><app-icon name="orders"/></span>', image('dispatch-parcels', 'inspector-illustration'));
replace('<span class="empty-icon"><app-icon name="person"/></span>', image('driver-van', 'inspector-illustration'));
replace('<app-icon name="orders"/><h3>{{orders().length', `@if(orders().length){<span class="search-empty-icon"><app-icon name="search"/></span>}@else{${image('dispatch-parcels')}}<h3>{{orders().length`);
replace('<app-icon name="drivers"/><h3>{{drivers().length', `@if(drivers().length){<span class="search-empty-icon"><app-icon name="search"/></span>}@else{${image('driver-van')}}<h3>{{drivers().length`);
replace('<app-icon name="arrow"/>Start delivery', '<app-icon name="start"/>Start delivery');
replace('<app-icon name="arrow"/>Resume delivery', '<app-icon name="start"/>Resume delivery');
replace('<app-icon name="check"/>Mark delivered', '<app-icon name="delivered"/>Mark delivered');
replace('<p class="delivery-complete"><app-icon name="check"/>', '<p class="delivery-complete"><app-icon name="delivered"/>');
fs.writeFileSync(path, html);
