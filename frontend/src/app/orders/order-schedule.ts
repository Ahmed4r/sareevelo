import { OrderStatus } from '../models';

export interface ScheduledOrder { status: OrderStatus; deliveryWindowEnd?: string | null; }
export type ScheduleFilter = 'ALL' | 'TODAY' | 'OVERDUE' | 'UNSCHEDULED';
export function unfinished(order: ScheduledOrder): boolean { return order.status !== 'DELIVERED' && order.status !== 'CANCELLED'; }
export function overdue(order: ScheduledOrder, now: number): boolean {
  return unfinished(order) && !!order.deliveryWindowEnd && Date.parse(order.deliveryWindowEnd) < now;
}
export function dueToday(order: ScheduledOrder, now: number): boolean {
  if (!unfinished(order) || !order.deliveryWindowEnd) return false;
  const due = new Date(order.deliveryWindowEnd), today = new Date(now);
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
}
export function matchesSchedule(order: ScheduledOrder, filter: ScheduleFilter, now: number): boolean {
  return filter === 'ALL' || (filter === 'OVERDUE' ? overdue(order, now) : filter === 'TODAY' ? dueToday(order, now) : unfinished(order) && !order.deliveryWindowEnd);
}
export function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function windowError(start: string, end: string): string {
  if (!start && !end) return '';
  if (!start || !end) return 'Enter both delivery window times, or clear both to leave this order unscheduled.';
  const first = new Date(start), last = new Date(end);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return 'Enter valid delivery dates and times.';
  // Reject local times skipped by the daylight-saving clock change instead of silently shifting them.
  if (localDateTime(first.toISOString()) !== start || localDateTime(last.toISOString()) !== end) return 'This local time does not exist because of a clock change. Choose another time.';
  return last.getTime() <= first.getTime() ? 'The delivery window must end after it starts.' : '';
}
