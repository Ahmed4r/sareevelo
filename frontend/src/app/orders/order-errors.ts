import { HttpErrorResponse } from '@angular/common/http';

export function orderErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Please try again.';
  if (error.status === 200) {
    return 'The server returned a page instead of order data. Restart the frontend to activate its API proxy.';
  }
  if (error.status === 0 || error.status === 502 || error.status === 504) {
    return 'Cannot reach the logistics service. Check that the backend is running and try again.';
  }
  if (error.status === 401) return 'Sign in to access the logistics workspace.';
  if (error.status === 403) return 'Your account cannot perform this action, or the security token expired. Refresh and try again.';
  if (error.status === 429) return 'AI or address lookup is busy. Wait a minute and retry.';
  if (error.status === 404) return 'The requested order or driver no longer exists. Refresh and try again.';
  if (error.status === 405) return 'The running logistics service does not support this action. Restart the backend with the latest application version, then try again. Your form values have been kept.';
  if (error.status >= 500) return 'The logistics service could not complete the request. Please try again.';
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  if (error.status === 409) return 'This request conflicts with saved data. Refresh and check availability or duplicate identifiers.';
  if (error.status === 400) return 'Check the required fields and their length, then try again.';
  return 'The request could not be completed. Please try again.';
}
