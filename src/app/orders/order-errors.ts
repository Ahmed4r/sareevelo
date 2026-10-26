import { HttpErrorResponse } from '@angular/common/http';

export function orderErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Please try again.';
  if (error.status === 200) {
    return 'The server returned a page instead of order data. Restart the frontend to activate its API proxy.';
  }
  if (error.status === 0 || error.status === 502 || error.status === 504) {
    return 'Cannot reach the order service. Check that the backend is running and try again.';
  }
  if (error.status === 404) return 'This delivery no longer exists. Refresh the delivery list.';
  if (error.status >= 500) return 'The order service could not complete the request. Please try again.';
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  if (error.status === 409) return 'This tracking number is already in use. Enter a different tracking number.';
  if (error.status === 400) return 'Check the required fields and their length, then try again.';
  return 'The request could not be completed. Please try again.';
}
