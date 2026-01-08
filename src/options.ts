/**
 * WakaTime Options and Configuration Management
 * 
 * Handles reading and writing configuration settings from INI files.
 * Manages API keys, URLs, and other settings from multiple sources.
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { Desktop } from './desktop';
import { Logger } from './logger';
import { Utils } from './utils';

/**
 * Represents a configuration setting with its key, value, and optional error
 */
export interface Setting {
  /** Setting key name */
  key: string;
  
  /** Setting value */
  value: string;
  
  /** Optional error message if setting could not be retrieved */
  error?: string;
}

/**
 * Options class for managing WakaTime configuration
 * Handles reading/writing settings from config files and editor settings
 */
export class Options {
  /** Path to main WakaTime config file (~/.wakatime.cfg) */
  private configFile: string;
  
  /** Path to internal config file for extension-specific settings */
  private internalConfigFile: string;
  
  /** Path to WakaTime log file */
  private logFile: string;
  
  /** Logger instance */
  private logger: Logger;
  
  /** Cache for API keys and URLs to reduce file I/O */
  private cache: any = {};

  /**
   * Creates a new Options instance
   * @param logger - Logger instance for debugging
   * @param resourcesFolder - Folder path for storing internal config and logs
   */
  constructor(logger: Logger, resourcesFolder: string) {
    this.logger = logger;
    this.configFile = path.join(Desktop.getHomeDirectory(), '.wakatime.cfg');
    this.internalConfigFile = path.join(resourcesFolder, 'wakatime-internal.cfg');
    this.logFile = path.join(resourcesFolder, 'wakatime.log');
  }

  /**
   * Gets a setting value asynchronously using Promise
   * @param section - INI section name
   * @param key - Setting key name
   * @returns Promise resolving to setting value
   */
  public async getSettingAsync<T = any>(section: string, key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.getSetting(section, key, false, (setting) => {
        setting.error ? reject(setting.error) : resolve(setting.value);
      });
    });
  }

  /**
   * Gets a setting value from INI config file
   * Parses INI format and finds the key in the specified section
   * @param section - INI section name (e.g., "settings")
   * @param key - Setting key name (e.g., "api_key")
   * @param internal - Whether to read from internal config file
   * @param callback - Callback function receiving the Setting object
   */
  public getSetting(
    section: string,
    key: string,
    internal: boolean,
    callback: (Setting) => void,
  ): void {
    fs.readFile(
      this.getConfigFile(internal),
      'utf-8',
      (err: NodeJS.ErrnoException | null, content: string) => {
        if (err) {
          callback({
            error: new Error(`could not read ${this.getConfigFile(internal)}`),
            key: key,
            value: null,
          });
        } else {
          let currentSection = '';
          let lines = content.split('\n');
          // Parse INI format line by line
          for (var i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Check for section headers [section_name]
            if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
              currentSection = line
                .trim()
                .substring(1, line.trim().length - 1)
                .toLowerCase();
            } else if (currentSection === section) {
              // Parse key=value pairs in the current section
              let parts = line.split('=');
              let currentKey = parts[0].trim();
              if (currentKey === key && parts.length > 1) {
                callback({ key: key, value: this.removeNulls(parts[1].trim()) });
                return;
              }
            }
          }

          // Setting not found
          callback({ key: key, value: null });
        }
      },
    );
  }

  /**
   * Sets a setting value in the INI config file
   * Creates the file and section if they don't exist
   * @param section - INI section name
   * @param key - Setting key name
   * @param val - Setting value to write
   * @param internal - Whether to write to internal config file
   */
  public setSetting(section: string, key: string, val: string, internal: boolean): void {
    const configFile = this.getConfigFile(internal);
    fs.readFile(configFile, 'utf-8', (err: NodeJS.ErrnoException | null, content: string) => {
      // ignore errors because config file might not exist yet
      if (err) content = '';

      let contents: string[] = [];
      let currentSection = '';

      let found = false;
      let lines = content.split('\n');
      for (var i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
          // Add the key before leaving the section if not found yet
          if (currentSection === section && !found) {
            contents.push(this.removeNulls(key + ' = ' + val));
            found = true;
          }
          currentSection = line
            .trim()
            .substring(1, line.trim().length - 1)
            .toLowerCase();
          contents.push(this.removeNulls(line));
        } else if (currentSection === section) {
          let parts = line.split('=');
          let currentKey = parts[0].trim();
          if (currentKey === key) {
            // Update existing key with new value
            if (!found) {
              contents.push(this.removeNulls(key + ' = ' + val));
              found = true;
            }
          } else {
            contents.push(this.removeNulls(line));
          }
        } else {
          contents.push(this.removeNulls(line));
        }
      }

      // Add the key/value if it wasn't found in existing content
      if (!found) {
        if (currentSection !== section) {
          contents.push('[' + section + ']');
        }
        contents.push(this.removeNulls(key + ' = ' + val));
      }

      fs.writeFile(configFile as string, contents.join('\n'), (err) => {
        if (err) throw err;
      });
    });
  }

  /**
   * Sets multiple settings at once in the INI config file
   * More efficient than calling setSetting multiple times
   * @param section - INI section name
   * @param settings - Array of Setting objects to write
   * @param internal - Whether to write to internal config file
   */
  public setSettings(section: string, settings: Setting[], internal: boolean): void {
    const configFile = this.getConfigFile(internal);
    fs.readFile(configFile, 'utf-8', (err: NodeJS.ErrnoException | null, content: string) => {
      // ignore errors because config file might not exist yet
      if (err) content = '';

      let contents: string[] = [];
      let currentSection = '';

      const found: Record<string, boolean> = {};
      let lines = content.split('\n');
      for (var i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
          if (currentSection === section) {
            settings.forEach((setting) => {
              if (!found[setting.key]) {
                contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
                found[setting.key] = true;
              }
            });
          }
          currentSection = line
            .trim()
            .substring(1, line.trim().length - 1)
            .toLowerCase();
          contents.push(this.removeNulls(line));
        } else if (currentSection === section) {
          let parts = line.split('=');
          let currentKey = parts[0].trim();
          let keepLineUnchanged = true;
          settings.forEach((setting) => {
            if (currentKey === setting.key) {
              keepLineUnchanged = false;
              if (!found[setting.key]) {
                contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
                found[setting.key] = true;
              }
            }
          });
          if (keepLineUnchanged) {
            contents.push(this.removeNulls(line));
          }
        } else {
          contents.push(this.removeNulls(line));
        }
      }

      settings.forEach((setting) => {
        if (!found[setting.key]) {
          if (currentSection !== section) {
            contents.push('[' + section + ']');
            currentSection = section;
          }
          contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
          found[setting.key] = true;
        }
      });

      fs.writeFile(configFile as string, contents.join('\n'), (err) => {
        if (err) throw err;
      });
    });
  }

  /**
   * Gets the path to the config file
   * @param internal - Whether to get internal or user config file path
   * @returns Path to config file
   */
  public getConfigFile(internal: boolean): string {
    return internal ? this.internalConfigFile : this.configFile;
  }

  /**
   * Gets the path to the log file
   * @returns Path to log file
   */
  public getLogFile(): string {
    return this.logFile;
  }

  /**
   * Gets the API key from multiple sources in priority order
   * Priority: Editor settings > Environment variable > Vault command > Config file
   * Detects and reports conflicts between different sources
   * @returns Promise resolving to API key string
   */
  public async getApiKey(): Promise<string> {
    // Return cached key if valid
    if (!Utils.apiKeyInvalid(this.cache.api_key)) {
      return this.cache.api_key;
    }

    let from = '';

    // Check editor settings first (VS Code settings.json)
    const keyFromSettings = this.getApiKeyFromEditor();
    if (!Utils.apiKeyInvalid(keyFromSettings)) {
      this.cache.api_key = keyFromSettings;
      from = 'settings.json editor';
    }

    // Check environment variable (WAKATIME_API_KEY)
    const keyFromEnv = this.getApiKeyFromEnv();
    if (!Utils.apiKeyInvalid(keyFromEnv)) {
      if (this.cache.api_key && this.cache.api_key !== keyFromEnv) {
        vscode.window.showErrorMessage(
          `WakaTime API Key conflict. Your env key doesn't match your ${from} key.`,
        );
        return this.cache.api_key;
      }
      this.cache.api_key = keyFromEnv;
      from = 'env var';
    }

    // Check vault command (api_key_vault_cmd setting)
    try {
      const apiKeyFromVault = await this.getApiKeyFromVaultCmd();
      if (!Utils.apiKeyInvalid(apiKeyFromVault)) {
        if (this.cache.api_key && this.cache.api_key !== apiKeyFromVault) {
          vscode.window.showErrorMessage(
            `WakaTime API Key conflict. Your vault command key doesn't match your ${from} key.`,
          );
          return this.cache.api_key;
        }
        this.cache.api_key = apiKeyFromVault;
        from = 'vault command';
      }
    } catch (err) {}

    // Finally, check config file (~/.wakatime.cfg)
    try {
      const apiKey = await this.getSettingAsync<string>('settings', 'api_key');
      if (!Utils.apiKeyInvalid(apiKey)) {
        if (this.cache.api_key && this.cache.api_key !== apiKey) {
          vscode.window.showErrorMessage(
            `WakaTime API Key conflict. Your ~/.wakatime.cfg key doesn't match your ${from} key.`,
          );
        }
        this.cache.api_key = apiKey;
      }
    } catch (err) {
      this.logger.debug(`Exception while reading API Key from config file: ${err}`);
      // Special handling for Microsoft Defender blocking issue
      if (!this.cache.api_key && `${err}`.includes('spawn EPERM')) {
        vscode.window.showErrorMessage(
          'Microsoft Defender is blocking WakaTime. Please allow WakaTime to run so it can upload code stats to your dashboard.',
        );
      }
    }

    return this.cache.api_key ?? '';
  }

  /**
   * Retrieves API key from a vault command
   * Executes the command specified in api_key_vault_cmd setting
   * Compatible with wakatime-cli vault command logic
   * @returns Promise resolving to API key from vault command
   */
  public async getApiKeyFromVaultCmd(): Promise<string> {
    try {
      // Use basically the same logic as wakatime-cli to interpret cmdStr
      // https://github.com/wakatime/wakatime-cli/blob/1fd560a/cmd/params/params.go#L697
      const cmdStr = await this.getSettingAsync<string>('settings', 'api_key_vault_cmd');
      if (!cmdStr?.trim()) return '';

      // Parse command string into command name and arguments
      const cmdParts = cmdStr.trim().split(' ');
      if (cmdParts.length === 0) return '';

      const [cmdName, ...cmdArgs] = cmdParts;

      const options = Desktop.buildOptions();
      const proc = child_process.spawn(cmdName, cmdArgs, options);

      let stdout = '';
      for await (const chunk of proc.stdout) {
        stdout += chunk;
      }
      let stderr = '';
      for await (const chunk of proc.stderr) {
        stderr += chunk;
      }
      const exitCode = await new Promise((resolve) => {
        proc.on('close', resolve);
      });

      if (exitCode) this.logger.warn(`api key vault command error (${exitCode}): ${stderr}`);
      else if (stderr && stderr.trim()) this.logger.warn(stderr.trim());

      const apiKey = stdout.toString().trim();
      return apiKey;
    } catch (err) {
      this.logger.debug(`Exception while reading API Key Vault Cmd from config file: ${err}`);
      return '';
    }
  }

  /**
   * Gets API key from VS Code editor settings (settings.json)
   * @returns API key from wakatime.apiKey setting
   */
  public getApiKeyFromEditor(): string {
    return vscode.workspace.getConfiguration().get('wakatime.apiKey') || '';
  }

  /**
   * Gets API URL from VS Code editor settings (settings.json)
   * @returns API URL from wakatime.apiUrl setting
   */
  private getApiUrlFromEditor(): string {
    return vscode.workspace.getConfiguration().get('wakatime.apiUrl') || '';
  }

  /**
   * Gets status bar alignment from VS Code settings
   * @returns Left or Right alignment for status bar item
   */
  public getStatusBarAlignment(): vscode.StatusBarAlignment {
    const align: string = vscode.workspace.getConfiguration().get('wakatime.align') ?? '';
    switch (align) {
      case 'left':
        return vscode.StatusBarAlignment.Left;
      case 'right':
        return vscode.StatusBarAlignment.Right;
      default:
        return vscode.StatusBarAlignment.Left;
    }
  }

  /**
   * Gets status bar priority from VS Code settings
   * Higher values position the item more to the left
   * @returns Priority number (default: 1)
   */
  public getStatusBarPriority(): number {
    const priority = vscode.workspace.getConfiguration().get('wakatime.alignPriority');
    return typeof priority === 'number' ? priority : 1;
  }

  /**
   * Gets API key from environment variable
   * Supports gitpod.io and similar environments
   * @see https://github.com/wakatime/vscode-wakatime/pull/220
   * @returns API key from WAKATIME_API_KEY environment variable
   */
  public getApiKeyFromEnv(): string {
    if (this.cache.api_key_from_env !== undefined) return this.cache.api_key_from_env;

    this.cache.api_key_from_env = process.env.WAKATIME_API_KEY || '';

    return this.cache.api_key_from_env;
  }

  /**
   * Gets API URL from multiple sources
   * Priority: Editor settings > Environment variable > Config file > Default
   * @param checkSettingsFile - Whether to check ~/.wakatime.cfg file
   * @returns Promise resolving to API URL
   */
  public async getApiUrl(checkSettingsFile = false): Promise<string> {
    let apiUrl = this.getApiUrlFromEditor();

    if (!apiUrl) {
      apiUrl = this.getApiUrlFromEnv();
    }

    if (!apiUrl && !checkSettingsFile) {
      return '';
    }

    // Validate URL format; people often accidentally enter their API Key into the API Url settings
    if (!Utils.validateApiUrl(apiUrl)) apiUrl = '';

    if (!apiUrl) {
      try {
        apiUrl = await this.getSettingAsync<string>('settings', 'api_url');
      } catch (err) {
        this.logger.debug(`Exception while reading API Url from config file: ${err}`);
      }
    }

    // Use default WakaTime API URL if not configured
    if (!apiUrl) apiUrl = 'https://api.wakatime.com/api/v1';

    // Strip common API endpoint suffixes to get base URL
    const suffixes = ['/', '.bulk', '/users/current/heartbeats', '/heartbeats', '/heartbeat'];
    for (const suffix of suffixes) {
      if (apiUrl.endsWith(suffix)) {
        apiUrl = apiUrl.slice(0, -suffix.length);
      }
    }

    return apiUrl;
  }

  /**
   * Gets API URL from environment variable
   * @returns API URL from WAKATIME_API_URL environment variable
   */
  private getApiUrlFromEnv(): string {
    if (this.cache.api_url_from_env !== undefined) return this.cache.api_url_from_env;

    this.cache.api_url_from_env = process.env.WAKATIME_API_URL || '';

    return this.cache.api_url_from_env;
  }

  /**
   * Checks if a valid API key is configured
   * @param callback - Callback function receiving true if valid key exists
   */
  public hasApiKey(callback: (valid: boolean) => void): void {
    this.getApiKey()
      .then((apiKey) => callback(!Utils.apiKeyInvalid(apiKey)))
      .catch((err) => {
        this.logger.warn(`Unable to check for api key: ${err}`);
        callback(false);
      });
  }

  /**
   * Checks if a string starts with another string
   * @param outer - String to check
   * @param inner - Prefix to look for
   * @returns true if outer starts with inner
   */
  private startsWith(outer: string, inner: string): boolean {
    return outer.slice(0, inner.length) === inner;
  }

  /**
   * Checks if a string ends with another string
   * @param outer - String to check
   * @param inner - Suffix to look for
   * @returns true if outer ends with inner
   */
  private endsWith(outer: string, inner: string): boolean {
    return inner === '' || outer.slice(-inner.length) === inner;
  }

  /**
   * Removes null characters from a string
   * @param s - String to clean
   * @returns String with null characters removed
   */
  private removeNulls(s: string): string {
    return s.replace(/\0/g, '');
  }
}
