import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

function extractUnknownMessage(exception: unknown): string {
  if (exception instanceof Error) return exception.message;
  if (typeof exception === 'string') return exception;
  if (exception && typeof exception === 'object') {
    const o = exception as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.msg === 'string') return o.msg;
  }
  try {
    return JSON.stringify(exception);
  } catch {
    return String(exception);
  }
}

/**
 * HttpException bodies pass through.
 * Other errors: message text when not hiding details.
 *
 * Details are shown if NODE_ENV is not "production", or if any of:
 *   EXPOSE_API_ERRORS=1|true, API_EXPOSE_ERROR_DETAILS=1|true
 *
 * To force hide in dev: API_REDACT_ERRORS=1
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private shouldExposeDetails(): boolean {
    if (['1', 'true', 'yes'].includes(String(process.env.API_REDACT_ERRORS).toLowerCase())) {
      return false;
    }
    if (
      ['1', 'true', 'yes'].includes(String(process.env.EXPOSE_API_ERRORS).toLowerCase()) ||
      ['1', 'true', 'yes'].includes(String(process.env.API_EXPOSE_ERROR_DETAILS).toLowerCase())
    ) {
      return true;
    }
    return process.env.NODE_ENV !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const exposeDetails = this.shouldExposeDetails();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const base =
        typeof raw === 'string'
          ? { statusCode: status, message: raw }
          : { ...(typeof raw === 'object' && raw !== null ? raw : {}), statusCode: status };

      if (
        exposeDetails &&
        status === HttpStatus.INTERNAL_SERVER_ERROR &&
        typeof base === 'object' &&
        base !== null
      ) {
        const cause = (exception as Error & { cause?: unknown }).cause;
        const causeMsg = extractUnknownMessage(cause);
        const currentMsg = (base as { message?: unknown }).message;
        const generic =
          currentMsg === 'Internal server error' ||
          currentMsg === HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR];
        if (cause && causeMsg && generic) {
          (base as { message: string }).message = causeMsg;
        }
      }

      response.status(status).json(base);
      return;
    }

    const messageText = extractUnknownMessage(exception);
    this.logger.error(messageText, exception instanceof Error ? exception.stack : undefined);

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const body: Record<string, unknown> = {
      statusCode: status,
      message: exposeDetails ? messageText : 'Internal server error',
    };
    if (exposeDetails && process.env.NODE_ENV === 'development') {
      body.stack = exception instanceof Error ? exception.stack : undefined;
    }
    response.status(status).json(body);
  }
}
