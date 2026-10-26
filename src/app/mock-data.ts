import { ActivityEvent, Driver, Order } from './models';

export const INITIAL_ORDERS: Order[] = [
  {id:'FL-20481',customer:'Bavaria Electronics',destination:'Passau · Innstadt',status:'IN_TRANSIT',priority:'HIGH',etaMinutes:12,driverId:'DR-01',createdAt:'2026-10-26T09:01:00'},
  {id:'FL-20482',customer:'Müller & Partner',destination:'Passau · Altstadt',status:'PENDING',priority:'NORMAL',etaMinutes:27,driverId:null,createdAt:'2026-10-26T09:03:00'},
  {id:'FL-20483',customer:'Donau Supplies',destination:'Vilshofen an der Donau',status:'DELAYED',priority:'HIGH',etaMinutes:48,driverId:'DR-03',createdAt:'2026-10-26T09:05:00'},
  {id:'FL-20484',customer:'Kern Medical',destination:'Passau · Haidenhof',status:'IN_TRANSIT',priority:'NORMAL',etaMinutes:19,driverId:'DR-02',createdAt:'2026-10-26T09:11:00'},
  {id:'FL-20485',customer:'Wagner Werkzeuge',destination:'Passau · Grubweg',status:'DELIVERED',priority:'NORMAL',etaMinutes:0,driverId:'DR-04',createdAt:'2026-10-26T09:12:00'},
  {id:'FL-20486',customer:'Nordlicht GmbH',destination:'Passau · Neustift',status:'IN_TRANSIT',priority:'HIGH',etaMinutes:34,driverId:'DR-05',createdAt:'2026-10-26T09:18:00'},
  {id:'FL-20487',customer:'Studio König',destination:'Passau · Kohlbruck',status:'PENDING',priority:'NORMAL',etaMinutes:40,driverId:null,createdAt:'2026-10-26T09:20:00'}
];
export const INITIAL_DRIVERS: Driver[] = [
  {id:'DR-01',name:'Lukas Weber',status:'BUSY',lat:48.576,lng:13.460,load:4,maxLoad:8},
  {id:'DR-02',name:'Mia Fischer',status:'BUSY',lat:48.568,lng:13.424,load:3,maxLoad:8},
  {id:'DR-03',name:'Jonas Bauer',status:'BUSY',lat:48.580,lng:13.384,load:6,maxLoad:8},
  {id:'DR-04',name:'Emma Schneider',status:'AVAILABLE',lat:48.573,lng:13.442,load:0,maxLoad:8},
  {id:'DR-05',name:'Noah Hoffmann',status:'BUSY',lat:48.562,lng:13.446,load:5,maxLoad:8},
  {id:'DR-06',name:'Lea Richter',status:'AVAILABLE',lat:48.591,lng:13.444,load:0,maxLoad:8}
];
export const INITIAL_ACTIVITY: ActivityEvent[] = [
  {id:'EV-01',type:'order_delayed',message:'FL-20483 flagged as delayed',timestamp:'2026-10-26T09:42:00'},
  {id:'EV-02',type:'driver_assigned',message:'Noah assigned to FL-20486',timestamp:'2026-10-26T09:38:00'},
  {id:'EV-03',type:'order_delivered',message:'FL-20485 successfully delivered',timestamp:'2026-10-26T09:32:00'},
  {id:'EV-04',type:'order_created',message:'New order FL-20487 received',timestamp:'2026-10-26T09:20:00'}
];
