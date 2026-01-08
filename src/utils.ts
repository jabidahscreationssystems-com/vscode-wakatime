/**
 * WakaTime Utility Functions
 * 
 * Collection of utility methods for validation, formatting, and detection.
 * Provides helper functions used throughout the extension.
 */

import * as vscode from 'vscode';
import { TIME_BETWEEN_HEARTBEATS_MS } from './constants';

/**
 * Utility class containing static helper methods
 */
export class Utils {
  /**
   * Map of editor application names to their short identifiers
   */
  private static appNames = {
    'Arduino IDE': 'arduino',
    'Azure Data Studio': 'azdata',
    Cursor: 'cursor',
    Onivim: 'onivim',
    'Onivim 2': 'onivim',
    'SQL Operations Studio': 'sqlops',
    Trae: 'trae',
    'Visual Studio Code': 'vscode',
    Windsurf: 'windsurf',
  };

  /**
   * Quotes a string if it contains spaces
   * Escapes existing quotes in the string
   * @param str - String to quote
   * @returns Quoted string if it contains spaces, otherwise original string
   */
  public static quote(str: string): string {
    if (str.includes(' ')) return `"${str.replace('"', '\\"')}"`;
    return str;
  }

  /**
   * Validates a WakaTime API key format
   * API keys should be UUID v4 format, optionally prefixed with 'waka_'
   * @param key - API key to validate
   * @returns Empty string if valid, error message if invalid
   */
  public static apiKeyInvalid(key?: string): string {
    const err = 'Invalid api key... check https://wakatime.com/api-key for your key';
    if (!key) return err;
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y is 8, 9, a, or b
    const re = new RegExp(
      '^(waka_)?[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$',
      'i',
    );
    if (!re.test(key)) return err;
    return '';
  }

  /**
   * Validates an API URL format
   * Must start with http:// or https://
   * @param url - URL to validate
   * @returns Trimmed URL if valid, empty string if invalid
   */
  public static validateApiUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url.trim();
    return '';
  }

  /**
   * Validates a proxy configuration string
   * Supports HTTP, HTTPS, SOCKS5 proxies and Windows domain format
   * Handles both IPv4, IPv6, and hostname formats
   * @param proxy - Proxy string to validate
   * @returns Empty string if valid, error message if invalid
   */
  public static validateProxy(proxy: string): string {
    if (!proxy) return '';
    let re;
    // Check for Windows domain format (contains backslash)
    if (proxy.indexOf('\\') === -1) {
      // Standard proxy format: protocol://user:pass@host:port
      re = new RegExp('^((https?|socks5)://)?([^:@]+(:([^:@])+)?@)?[\\w\\.-]+(:\\d+)?$', 'i');
    } else {
      // Windows domain format: domain\user:pass
      re = new RegExp('^.*\\\\.+$', 'i');
    }
    if (!re.test(proxy)) {
      // Try IPv6 format
      const ipv6 = new RegExp(
        '^((https?|socks5)://)?([^:@]+(:([^:@])+)?@)?(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(:\\d+)?$',
        'i',
      );
      if (!ipv6.test(proxy)) {
        return 'Invalid proxy. Valid formats are https://user:pass@host:port or socks5://user:pass@host:port or domain\\user:pass';
      }
    }
    return '';
  }

  /**
   * Formats a Date object into a human-readable string
   * Format: "Mon DD, YYYY HH:MM AM/PM"
   * @param date - Date to format
   * @returns Formatted date string
   */
  public static formatDate(date: Date): String {
    let months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    let ampm = 'AM';
    let hour = date.getHours();
    if (hour > 11) {
      ampm = 'PM';
      hour = hour - 12;
    }
    if (hour == 0) {
      hour = 12;
    }
    let minute = date.getMinutes();
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${hour}:${
      minute < 10 ? `0${minute}` : minute
    } ${ampm}`;
  }

  /**
   * Obfuscates an API key for display/logging
   * Shows only the last 4 characters, replacing the rest with X's
   * @param key - API key to obfuscate
   * @returns Obfuscated key
   */
  public static obfuscateKey(key: string): string {
    let newKey = '';
    if (key) {
      newKey = key;
      if (key.length > 4)
        newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
    }
    return newKey;
  }

  /**
   * Wraps an argument in quotes if it contains spaces
   * Escapes existing quotes
   * @param arg - Argument to wrap
   * @returns Wrapped argument
   */
  public static wrapArg(arg: string): string {
    if (arg.indexOf(' ') > -1) return '"' + arg.replace(/"/g, '\\"') + '"';
    return arg;
  }

  /**
   * Formats command arguments for display/logging
   * Obfuscates API keys and wraps arguments with spaces
   * @param binary - Binary path
   * @param args - Array of arguments
   * @returns Formatted command string
   */
  public static formatArguments(binary: string, args: string[]): string {
    let clone = args.slice(0);
    clone.unshift(this.wrapArg(binary));
    let newCmds: string[] = [];
    let lastCmd = '';
    for (let i = 0; i < clone.length; i++) {
      // Obfuscate the value after --key flag
      if (lastCmd == '--key') newCmds.push(this.wrapArg(this.obfuscateKey(clone[i])));
      else newCmds.push(this.wrapArg(clone[i]));
      lastCmd = clone[i];
    }
    return newCmds.join(' ');
  }

  /**
   * Checks if a URI is a remote URI (e.g., SSH remote)
   * @param uri - VS Code URI to check
   * @returns true if URI is remote, false otherwise
   */
  public static isRemoteUri(uri: vscode.Uri): boolean {
    if (!uri) return false;
    return uri.scheme === 'vscode-remote';
  }

  /**
   * Converts an API URL to its corresponding dashboard URL
   * Removes 'api.' subdomain and '/api/v1' path
   * @param url - API URL to convert
   * @returns Dashboard URL
   */
  public static apiUrlToDashboardUrl(url: string): string {
    url = url
      .replace('://api.', '://')
      .replace('/api/v1', '')
      .replace(/^api\./, '')
      .replace('/api', '');
    return url;
  }

  /**
   * Checks if enough time has passed since last heartbeat
   * @param lastHeartbeat - Timestamp of last heartbeat
   * @param now - Current timestamp
   * @returns true if enough time has passed, false otherwise
   */
  public static enoughTimePassed(lastHeartbeat: number, now: number): boolean {
    return lastHeartbeat + TIME_BETWEEN_HEARTBEATS_MS < now;
  }

  /**
   * Checks if a URI represents a pull request
   * @param uri - VS Code URI to check
   * @returns true if URI is a PR, false otherwise
   */
  public static isPullRequest(uri: vscode.Uri): boolean {
    if (!uri) return false;
    return uri.scheme === 'pr';
  }

  /**
   * Detects if the current active editor is an AI chat sidebar
   * Checks for Claude Code and other AI sidebar URIs
   * @param uri - VS Code URI to check
   * @returns true if AI chat sidebar is active
   */
  public static isAIChatSidebar(uri: vscode.Uri | undefined): boolean {
    // first check if the active tab is the Claude Code sidebar
    const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
    const viewType = (activeTab?.input as { viewType?: string } | undefined)?.viewType;
    if (viewType?.includes('claude') && activeTab?.label.toLowerCase().includes('claude')) {
      return true;
    }

    // second, check if the active uri has an AI sidebar scheme
    if (!uri) return false;
    if (uri.fsPath.endsWith('.log')) return false;
    if (uri.scheme === 'vscode-chat-code-block') return true;
    if (uri.scheme === 'openai-codex') return true;
    return false;
  }

  /**
   * Heuristically determines if a text change might be AI-generated code
   * Checks for multi-line or long single-line insertions
   * @param e - Text document change event
   * @returns true if change looks like AI code insertion
   */
  public static isPossibleAICodeInsert(e: vscode.TextDocumentChangeEvent): boolean {
    if (e.document.fileName.endsWith('.log')) return false;
    if (e.contentChanges.length !== 1) return false;

    const text = e.contentChanges?.[0].text.trim();
    if (text.length <= 2) return false;

    // inserted text must be 2+ lines or single line 50+ chars long to qualify as AI
    return (text.match(/[\n\r]/g) || []).length > 2 || text.length > 50;
  }

  /**
   * Gets the file path for the currently focused document
   * Handles remote URIs by constructing proper remote paths
   * @param document - Text document to get path from
   * @returns File path string or undefined
   */
  public static getFocusedFile(document?: vscode.TextDocument): string | undefined {
    const doc = document ?? vscode.window.activeTextEditor?.document;
    if (doc) {
      const file = doc.fileName;
      if (Utils.isRemoteUri(doc.uri)) {
        // Convert remote URI to proper format (e.g., ssh://host/path)
        return `${doc.uri.authority}${doc.uri.path}`.replace('ssh-remote+', 'ssh://');
        // TODO: how to support 'dev-container', 'attached-container', 'wsl', and 'codespaces' schemes?
      }
      return file;
    }
  }

  /**
   * Heuristically determines if a text change is human-typed
   * Looks for single character insertions or deletions
   * @param e - Text document change event
   * @returns true if change looks like human input
   */
  public static isPossibleHumanCodeInsert(e: vscode.TextDocumentChangeEvent): boolean {
    if (e.contentChanges.length !== 1) return false;
    // Single printable character (not newline/return)
    if (
      e.contentChanges?.[0].text.trim().length === 1 &&
      e.contentChanges?.[0].text !== '\n' &&
      e.contentChanges?.[0].text !== '\r'
    )
      return true;
    // Deletion (empty text)
    if (e.contentChanges?.[0].text.length === 0) return true;
    return false;
  }

  /**
   * Gets the editor name identifier
   * Maps VS Code app name to short identifier
   * @returns Editor identifier string
   */
  public static getEditorName(): string {
    if (this.appNames[vscode.env.appName]) {
      return this.appNames[vscode.env.appName];
    } else if (vscode.env.appName.toLowerCase().includes('visual')) {
      return 'vscode';
    } else {
      return vscode.env.appName.replace(/\s/g, '').toLowerCase();
    }
  }

  /**
   * Checks if the editor has built-in AI capabilities
   * @returns true if editor is Cursor or Windsurf
   */
  public static isAICapableEditor(): boolean {
    const editorName = vscode.env.appName.toLowerCase();
    return editorName.includes('cursor') || editorName.includes('windsurf');
  }

  /**
   * Checks if any AI coding extensions are installed and active
   * Checks for common AI assistants like GitHub Copilot, Codeium, etc.
   * @returns true if AI extensions are detected
   */
  public static hasAIExtensions(): boolean {
    const commonAIExtensions = [
      'anthropic.claude-code',
      'codeium.codeium',
      'continue.continue',
      'github.copilot-chat',
      'github.copilot',
      'ms-vscode.vscode-ai-toolkit',
      'openai.openai-gpt-vscode',
      'openai.chatgpt',
      'sourcegraph.cody-ai',
      'supermaven.supermaven',
      'tabnine.tabnine-vscode',
    ];

    return commonAIExtensions.some((extensionId) => {
      const extension = vscode.extensions.getExtension(extensionId);
      return extension && extension.isActive;
    });
  }

  /**
   * Checks if AI coding features are available
   * Combines editor and extension checks
   * @returns true if AI capabilities are available
   */
  public static checkAICapabilities(): boolean {
    return this.isAICapableEditor() || this.hasAIExtensions();
  }
}

/**
 * File selection tracking data
 * Used to prevent duplicate heartbeats
 */
interface FileSelection {
  /** Last cursor position in the file */
  selection: vscode.Position;
  
  /** Timestamp of last heartbeat */
  lastHeartbeatAt: number;
}

/**
 * Map of file paths to their selection data
 */
export interface FileSelectionMap {
  [key: string]: FileSelection;
}

/**
 * Map of file paths to line counts
 */
export interface Lines {
  [fileName: string]: number;
}

/**
 * Line change tracking separated by AI and human changes
 */
export interface LineCounts {
  /** Lines changed by AI */
  ai: Lines;
  
  /** Lines changed by human */
  human: Lines;
}
