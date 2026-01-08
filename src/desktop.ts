/**
 * WakaTime Desktop Utilities
 * 
 * Platform-specific utilities for desktop environments.
 * Handles operating system detection and environment configuration.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { StdioOptions } from 'child_process';

/**
 * Desktop utility class for platform-specific operations
 */
export class Desktop {
  /**
   * Checks if the current platform is Windows
   * @returns true if running on Windows, false otherwise
   */
  public static isWindows(): boolean {
    return os.platform() === 'win32';
  }

  /**
   * Checks if VS Code is running in portable mode
   * @returns true if VSCODE_PORTABLE environment variable is set
   */
  public static isPortable(): boolean {
    return !!process.env['VSCODE_PORTABLE'];
  }

  /**
   * Gets the user's home directory
   * Priority: WAKATIME_HOME env var > VSCODE_PORTABLE > USERPROFILE/HOME > current directory
   * @returns Path to home directory
   */
  public static getHomeDirectory(): string {
    let home = process.env.WAKATIME_HOME;
    if (home && home.trim() && fs.existsSync(home.trim())) return home.trim();
    if (this.isPortable()) return process.env['VSCODE_PORTABLE'] as string;
    return process.env[this.isWindows() ? 'USERPROFILE' : 'HOME'] || process.cwd();
  }

  /**
   * Builds options for child process execution
   * @param stdin - Whether to enable stdin pipe for the process
   * @returns Options object for execFile
   */
  public static buildOptions(stdin?: boolean): Object {
    const options: child_process.ExecFileOptions = {
      windowsHide: true,
    };
    if (stdin) {
      (options as any).stdio = ['pipe', 'pipe', 'pipe'] as StdioOptions;
    }
    // Set WAKATIME_HOME if HOME is not set (edge case for some environments)
    if (!this.isWindows() && !process.env.WAKATIME_HOME && !process.env.HOME) {
      options['env'] = { ...process.env, WAKATIME_HOME: this.getHomeDirectory() };
    }
    return options;
  }
}
