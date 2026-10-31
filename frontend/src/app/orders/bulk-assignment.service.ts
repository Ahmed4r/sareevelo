import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, concatMap, defer, from, map, of, timeout } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { orderErrorMessage } from './order-errors';

export interface BulkAssignmentItem { id: number; trackingNumber: string; }
export interface BulkAssignmentResult extends BulkAssignmentItem {
  outcome: 'assigned' | 'failed' | 'unknown' | 'skipped';
  message: string;
}

/** Each order is its own transaction. Never retry an uncertain POST automatically. */
@Injectable({ providedIn: 'root' })
export class BulkAssignmentService {
  private readonly api = inject(OrderApiService);

  assign(items: readonly BulkAssignmentItem[], driverId: number) {
    return defer(() => {
      let stopped = false;
      return from(items).pipe(concatMap(item => {
        if (stopped) return of<BulkAssignmentResult>({ ...item, outcome: 'skipped', message: 'Not attempted. Refresh orders and capacity before trying again.' });
        return this.api.assignDriver(item.id, { driverId }).pipe(
          timeout(20000),
          map((): BulkAssignmentResult => ({ ...item, outcome: 'assigned', message: 'Driver assigned.' })),
          catchError((error: unknown) => {
            const definiteRejection = error instanceof HttpErrorResponse && [400, 404, 409].includes(error.status);
            stopped = !definiteRejection;
            return of<BulkAssignmentResult>({ ...item, outcome: definiteRejection ? 'failed' : 'unknown',
              message: definiteRejection ? orderErrorMessage(error) : 'Assignment could not be confirmed. It may have been saved. Refresh and review this order before retrying.' });
          })
        );
      }));
    });
  }
}
