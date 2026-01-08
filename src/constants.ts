/**
 * WakaTime Constants
 * 
 * This file contains all constant values used throughout the WakaTime extension,
 * including command identifiers, time intervals, and type definitions.
 */

/** Command identifier for API key configuration */
export const COMMAND_API_KEY = 'wakatime.apikey';

/** Command identifier for API URL configuration */
export const COMMAND_API_URL = 'wakatime.apiurl';

/** Command identifier for opening config file */
export const COMMAND_CONFIG_FILE = 'wakatime.config_file';

/** Command identifier for opening WakaTime dashboard */
export const COMMAND_DASHBOARD = 'wakatime.dashboard';

/** Command identifier for debug mode toggle */
export const COMMAND_DEBUG = 'wakatime.debug';

/** Command identifier for disabling/enabling extension */
export const COMMAND_DISABLE = 'wakatime.disable';

/** Command identifier for opening log file */
export const COMMAND_LOG_FILE = 'wakatime.log_file';

/** Command identifier for proxy configuration */
export const COMMAND_PROXY = 'wakatime.proxy';

/** Command identifier for status bar coding activity toggle */
export const COMMAND_STATUS_BAR_CODING_ACTIVITY = 'wakatime.status_bar_coding_activity';

/** Command identifier for status bar enabled/disabled toggle */
export const COMMAND_STATUS_BAR_ENABLED = 'wakatime.status_bar_enabled';

/**
 * Logging levels for the extension
 * Lower values represent more verbose logging
 */
export enum LogLevel {
  DEBUG = 0,  // Most verbose, includes all debug information
  INFO,       // Informational messages
  WARN,       // Warning messages
  ERROR,      // Error messages only
}

/** Time window (in milliseconds) to detect AI-generated code pastes */
export const AI_RECENT_PASTES_TIME_MS = 500;

/** Minimum time (in milliseconds) between sending heartbeats for the same file */
export const TIME_BETWEEN_HEARTBEATS_MS = 120000;

/** Time (in seconds) to buffer heartbeats before sending to API */
export const SEND_BUFFER_SECONDS = 30;

/**
 * Heartbeat data structure sent to WakaTime API
 * Represents a coding activity event
 */
export interface Heartbeat {
  /** Unix timestamp of the heartbeat */
  time: number;
  
  /** File path or entity being tracked */
  entity: string;
  
  /** Local file path for remote URIs */
  local_file?: string;
  
  /** Whether this heartbeat represents a file save event */
  is_write: boolean;
  
  /** Current line number in the file (1-indexed) */
  lineno: number;
  
  /** Current cursor position in the line (1-indexed) */
  cursorpos: number;
  
  /** Total number of lines in the file */
  lines_in_file: number;
  
  /** Alternative project name override */
  alternate_project?: string;
  
  /** Project folder path */
  project_folder?: string;
  
  /** Number of slashes in project root path */
  project_root_count?: number;
  
  /** Programming language of the file */
  language?: string;
  
  /** Activity category for the heartbeat */
  category?: 'debugging' | 'ai coding' | 'building' | 'code reviewing';
  
  /** Number of lines changed by AI */
  ai_line_changes?: number;
  
  /** Number of lines changed by human */
  human_line_changes?: number;
  
  /** Whether the entity hasn't been saved yet */
  is_unsaved_entity?: boolean;
}
