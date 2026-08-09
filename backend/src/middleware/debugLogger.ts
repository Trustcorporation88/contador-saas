import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Log de diagnóstico em arquivo — OPT-IN (DEBUG_FILE_LOG=true).
 *
 * Fica desligado por padrão porque a versão anterior rodava sempre: gravava de
 * forma síncrona (bloqueando o event loop) a cada requisição E a cada resposta
 * JSON, em um arquivo sem rotação, e o trecho da resposta incluía o início do
 * accessToken nas respostas de login.
 *
 * O log estruturado de produção é o requestLogger.
 */
const DEBUG_FILE_LOG_ENABLED = String(process.env.DEBUG_FILE_LOG || '').toLowerCase() === 'true';

const logFile = process.env.DEBUG_FILE_LOG_PATH || path.join(process.cwd(), 'debug.log');

function writeLog(message: string): void {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // diagnóstico não pode derrubar a requisição
  }
}

export function debugLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!DEBUG_FILE_LOG_ENABLED) {
    next();
    return;
  }

  // Só método, rota e status: corpo de resposta carrega token e dados do
  // cliente, e não há por que gravá-los em arquivo.
  res.on('finish', () => {
    writeLog(`${req.method} ${req.path} -> ${res.statusCode}`);
  });

  next();
}
