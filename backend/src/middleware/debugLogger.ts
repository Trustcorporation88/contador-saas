import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'debug.log');

function writeLog(message: string) {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, line);
  } catch (e) {
    // Silently fail if can't write
  }
}

export function debugLoggerMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  writeLog(`[MIDDLEWARE] Request: ${_req.method} ${_req.path}`);
  
  const originalJson = _res.json;
  _res.json = function (body: any) {
    writeLog(`[MIDDLEWARE] Response: ${_res.statusCode} ${JSON.stringify(body).substring(0, 100)}`);
    return originalJson.call(this, body);
  };
  
  next();
}
