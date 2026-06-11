import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { errorResponse } from '../utils/responseHandler';
import { ZodError } from 'zod';
import { captureError } from '../monitoring/monitoring';

/**
 * Global error handler middleware
 * Must be registered last in middleware chain
 */
export const errorHandler = (
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(422).json(
      errorResponse(
        'Validation Error',
        'VALIDATION_ERROR',
        issues
      )
    );
    return;
  }

  // Handle custom AppErrors
  if (error instanceof AppError) {
    // Capture server-side AppErrors (5xx) for monitoring; client errors (4xx)
    // are expected and don't need alerting.
    if (error.statusCode >= 500) {
      captureError(error, {
        statusCode: error.statusCode,
        path: req.originalUrl,
        method: req.method,
        restaurantId: (req as any).user?.restaurantId,
      });
    }
    res.status(error.statusCode).json(
      errorResponse(
        error.message,
        error.constructor.name
      )
    );
    return;
  }

  // Handle generic errors — always capture (these are unexpected)
  captureError(error, {
    statusCode: 500,
    path: req.originalUrl,
    method: req.method,
    restaurantId: (req as any).user?.restaurantId,
  });

  res.status(500).json(
    errorResponse(
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error.message,
      'INTERNAL_SERVER_ERROR'
    )
  );
};
