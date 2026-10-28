const fs=require('fs');
const path='src/app/app.component.html';
let h=fs.readFileSync(path,'utf8');
h=h.replace(/<div><span class="eyebrow section-index">[\s\S]*?<\/div>\r?\n        <div class="heading-actions">/,`<div><h1>{{currentTab() === 'Fleet' ? 'Drivers' : currentTab() === 'Deliveries' ? 'Orders' : 'Dispatch'}}</h1><p>{{currentTab() === 'Fleet' ? 'Find available capacity and keep your team moving.' : currentTab() === 'Deliveries' ? 'Search, assign and manage your deliveries.' : 'Your queue, priorities and available capacity.'}}</p></div>
        <div class="heading-actions">`);
const start=h.indexOf('        <section id="dispatch-workload"');
const end=h.indexOf('        </section>',start)+'        </section>'.length;
let workload=h.slice(start,end);
h=h.slice(0,start)+h.slice(end);
workload=workload.replace('<div class="workload"><span>Assigned orders</span><strong>{{loading() || loadError() ? \'—\' : summary().assigned}}</strong><small>Orders with a driver</small></div>',`<button class="workload" (click)="reviewToday()" [disabled]="loading() || !!loadError()"><span>Due today</span><strong>{{loading() || loadError() ? '—' : dueTodayCount()}}</strong><small>Review today's deliveries <app-icon name="arrow"/></small></button>`);
workload=workload.replace('<div class="workload"><span>Available capacity</span>', '<button class="workload" (click)="openOperationalAlert(\'capacity\')" [disabled]="driversLoading() || !!driversError()"><span>Available capacity</span>').replace("drivers with room'}}</small></div>","drivers with room'}}</small></button>");
workload=workload.replace('(click)="setFilter(\'DELAYED\')"','(click)="reviewDelayed()"');
h=h.replace('        <section class="operational-alerts"', workload+'\n        <section class="operational-alerts"');
h=h.replace('<span class="eyebrow">DISPATCH SIGNALS</span>','<span class="attention-caption">Resolve exceptions, then assign the queue</span>');
h=h.replace('[class.urgent]="alert.key === \'delayed\'"','[class.urgent]="alert.key === \'delayed\' || alert.key === \'overdue\'"');
h=h.replace('<div class="view-controls" aria-label="Workspace view controls">','<details class="view-settings"><summary><app-icon name="grid"/>View options <span>{{currentTab() === \'Fleet\' ? driverView() : orderView()}}</span></summary><div class="view-controls" aria-label="Workspace view controls">');
h=h.replace('          </div>\n          @if(currentTab() !== \'Fleet\') {','          </div></details>\n          @if(currentTab() !== \'Fleet\') {');
const marker='            <div class="bulk-toolbar"';
const s=h.indexOf(marker),e=h.indexOf('\n',s);
const bulk=h.slice(s,e);
h=h.slice(0,s)+h.slice(e);
const beforeView="            @if(orderView() !== 'table'";
const chips=`            @if(activeFilterCount()) {<div class="active-filters" aria-label="Active order filters"><span>{{visibleOrders().length}} matches</span>@if(query().trim()){<button (click)="query.set('')" aria-label="Remove search filter">Search: {{query()}} <app-icon name="close"/></button>}@if(unassignedOnly()){<button (click)="unassignedOnly.set(false)">Unassigned <app-icon name="close"/></button>}@if(filter() !== 'ALL'){<button (click)="setFilter('ALL')">{{statusLabel(filter())}} <app-icon name="close"/></button>}@if(scheduleFilter() !== 'ALL'){<button (click)="setScheduleFilter('ALL')">{{scheduleFilter() === 'TODAY' ? 'Due today' : scheduleFilter() === 'OVERDUE' ? 'Overdue' : 'Unscheduled'}} <app-icon name="close"/></button>}<button class="clear-filters" (click)="clearFilters()">Clear all filters</button></div>}
`;
h=h.replace(beforeView,chips+bulk+'\n'+beforeView);
h=h.replace('(click)="unassignedOnly() ? clearFilters() : showUnassigned()"','(click)="unassignedOnly.set(!unassignedOnly())"');
fs.writeFileSync(path,h);
