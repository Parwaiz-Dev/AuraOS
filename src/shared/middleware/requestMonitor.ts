/**
 * requestMonitor — measures each request's duration and feeds the monitoring
 * counters (total requests, slow requests, error rate).
 *
 * Registered early in the middleware chain so it wraps the whole request.
 * It hooks the response 'finish' event to record the outcome without
 * interfering with the response itself.
 */

import { Request, Response, NextFunction } from 'express';
import { trackRequest } from '../monitoring/monitoring';

export function requestMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    trackRequest(durationMs, res.statusCode);
  });

  next();
}
