/**
 * WakaTime Logger
 * 
 * Provides logging functionality with different severity levels.
 * Messages are formatted with [WakaTime][LEVEL] prefix and sent to console.
 */

import { LogLevel } from './constants';

/**
 * Logger class for managing application logging
 * Supports DEBUG, INFO, WARN, and ERROR log levels
 */
export class Logger {
  private level: LogLevel;

  /**
   * Creates a new Logger instance
   * @param level - Initial logging level
   */
  constructor(level: LogLevel) {
    this.setLevel(level);
  }

  /**
   * Gets the current logging level
   * @returns Current log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Sets the logging level
   * Only messages at or above this level will be logged
   * @param level - New logging level to set
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Logs a message at the specified level
   * @param level - Level at which to log the message
   * @param msg - Message to log
   */
  public log(level: LogLevel, msg: string): void {
    if (level >= this.level) {
      msg = `[WakaTime][${LogLevel[level]}] ${msg}`;
      if (level == LogLevel.DEBUG) console.log(msg);
      if (level == LogLevel.INFO) console.info(msg);
      if (level == LogLevel.WARN) console.warn(msg);
      if (level == LogLevel.ERROR) console.error(msg);
    }
  }

  /**
   * Logs a debug message
   * @param msg - Debug message to log
   */
  public debug(msg: string): void {
    this.log(LogLevel.DEBUG, msg);
  }

  /**
   * Logs an exception at DEBUG level
   * @param msg - Exception or error object to log
   */
  public debugException(msg: unknown): void {
    if ((msg as Error).message !== undefined) {
      this.log(LogLevel.DEBUG, (msg as Error).message);
    } else {
      this.log(LogLevel.DEBUG, (msg as Error).toString());
    }
  }

  /**
   * Logs an info message
   * @param msg - Info message to log
   */
  public info(msg: string): void {
    this.log(LogLevel.INFO, msg);
  }

  /**
   * Logs a warning message
   * @param msg - Warning message to log
   */
  public warn(msg: string): void {
    this.log(LogLevel.WARN, msg);
  }

  /**
   * Logs an exception at WARN level
   * @param msg - Exception or error object to log
   */
  public warnException(msg: unknown): void {
    if ((msg as Error).message !== undefined) {
      this.log(LogLevel.WARN, (msg as Error).message);
    } else {
      this.log(LogLevel.WARN, (msg as Error).toString());
    }
  }

  /**
   * Logs an error message
   * @param msg - Error message to log
   */
  public error(msg: string): void {
    this.log(LogLevel.ERROR, msg);
  }

  /**
   * Logs an exception at ERROR level
   * @param msg - Exception or error object to log
   */
  public errorException(msg: unknown): void {
    if ((msg as Error).message !== undefined) {
      this.log(LogLevel.ERROR, (msg as Error).message);
    } else {
      this.log(LogLevel.ERROR, (msg as Error).toString());
    }
  }
}
