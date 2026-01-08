/**
 * WakaTime Extension Entry Point (Web Version)
 * 
 * Main entry file for the WakaTime VS Code extension running in web/browser environments.
 * Handles extension activation, command registration, and deactivation for web-based VS Code.
 */

import * as vscode from 'vscode';

import {
  COMMAND_API_KEY,
  COMMAND_API_URL,
  COMMAND_DASHBOARD,
  COMMAND_DEBUG,
  COMMAND_DISABLE,
  COMMAND_STATUS_BAR_CODING_ACTIVITY,
  COMMAND_STATUS_BAR_ENABLED,
  LogLevel,
} from '../constants';

import { Logger } from './logger';
import { WakaTime } from './wakatime';

// Global logger instance
var logger = new Logger(LogLevel.INFO);

// Global WakaTime instance
var wakatime: WakaTime;

/**
 * Extension activation function (Web version)
 * Called when the extension is first activated in a web environment
 * 
 * @param ctx - VS Code extension context
 */
export function activate(ctx: vscode.ExtensionContext) {
  wakatime = new WakaTime(logger, ctx.globalState);

  // Sync API key across devices
  ctx.globalState?.setKeysForSync(['wakatime.apiKey']);

  // Register command: Set API Key
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_API_KEY, function () {
      wakatime.promptForApiKey();
    }),
  );

  // Register command: Set API URL
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_API_URL, function () {
      wakatime.promptForApiUrl();
    }),
  );

  // Register command: Toggle Debug Mode
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DEBUG, function () {
      wakatime.promptForDebug();
    }),
  );

  // Register command: Disable/Enable Extension
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DISABLE, function () {
      wakatime.promptToDisable();
    }),
  );

  // Register command: Toggle Status Bar Visibility
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_STATUS_BAR_ENABLED, function () {
      wakatime.promptStatusBarIcon();
    }),
  );

  // Register command: Toggle Status Bar Coding Activity
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_STATUS_BAR_CODING_ACTIVITY, function () {
      wakatime.promptStatusBarCodingActivity();
    }),
  );

  // Register command: Open WakaTime Dashboard
  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DASHBOARD, function () {
      wakatime.openDashboardWebsite();
    }),
  );

  // Add WakaTime instance to subscriptions for proper cleanup
  ctx.subscriptions.push(wakatime);
  
  // Initialize WakaTime functionality
  wakatime.initialize();
}

/**
 * Extension deactivation function (Web version)
 * Called when the extension is deactivated
 * Ensures proper cleanup and sends any pending heartbeats
 */
export function deactivate() {
  wakatime.dispose();
}
