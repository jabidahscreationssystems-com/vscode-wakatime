/**
 * WakaTime CLI Dependencies Manager
 * 
 * Handles downloading, installing, and updating the wakatime-cli binary.
 * Manages version checking and platform-specific binary selection.
 */

import * as adm_zip from 'adm-zip';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as request from 'request';
import * as semver from 'semver';
import * as which from 'which';

import { Options, Setting } from './options';

import { Desktop } from './desktop';
import { Logger } from './logger';

/**
 * Operating system names supported by wakatime-cli
 */
enum osName {
  darwin = 'darwin',
  windows = 'windows',
  linux = 'linux',
}

/**
 * Dependencies class for managing wakatime-cli binary
 * Handles automatic download, installation, and updates
 */
export class Dependencies {
  private options: Options;
  private logger: Logger;
  
  /** Location for storing downloaded CLI */
  private resourcesLocation: string;
  
  /** Cached path to local CLI binary */
  private cliLocation?: string = undefined;
  
  /** Cached path to globally installed CLI */
  private cliLocationGlobal?: string = undefined;
  
  /** Whether CLI is confirmed to be installed */
  private cliInstalled: boolean = false;
  
  /** GitHub URL for downloading latest CLI release */
  private githubDownloadUrl = 'https://github.com/wakatime/wakatime-cli/releases/latest/download';
  
  /** GitHub API URL for checking latest CLI version */
  private githubReleasesUrl = 'https://api.github.com/repos/wakatime/wakatime-cli/releases/latest';
  
  /**
   * Legacy OS versions that require specific CLI versions
   * Maps OS names to kernel version requirements and corresponding CLI tags
   */
  private legacyOperatingSystems: {
    [key in osName]?: {
      kernelLessThan: string;
      tag: string;
    }[];
  } = {
    // macOS Sierra and older require legacy CLI version
    [osName.darwin]: [{ kernelLessThan: '17.0.0', tag: 'v1.39.1-alpha.1' }],
  };

  /**
   * Creates a new Dependencies manager instance
   * @param options - Options instance for configuration
   * @param logger - Logger instance for debugging
   * @param resourcesLocation - Directory path for storing CLI binaries
   */
  constructor(options: Options, logger: Logger, resourcesLocation: string) {
    this.options = options;
    this.logger = logger;
    this.resourcesLocation = resourcesLocation;
  }

  /**
   * Gets the path to the wakatime-cli binary
   * Checks for global installation first, then local installation
   * @returns Path to CLI binary
   */
  public getCliLocation(): string {
    if (this.cliLocation) return this.cliLocation;

    // Check for globally installed CLI first
    this.cliLocation = this.getCliLocationGlobal();
    if (this.cliLocation) return this.cliLocation;

    // Build local CLI path based on OS and architecture
    const osname = this.osName();
    const arch = this.architecture();
    const ext = Desktop.isWindows() ? '.exe' : '';
    const binary = `wakatime-cli-${osname}-${arch}${ext}`;
    this.cliLocation = path.join(this.resourcesLocation, binary);

    return this.cliLocation;
  }

  /**
   * Finds globally installed wakatime-cli using PATH
   * @returns Path to global CLI or undefined if not found
   */
  public getCliLocationGlobal(): string | undefined {
    if (this.cliLocationGlobal) return this.cliLocationGlobal;

    const binaryName = `wakatime-cli${Desktop.isWindows() ? '.exe' : ''}`;
    const path = which.sync(binaryName, { nothrow: true });
    if (path) {
      this.cliLocationGlobal = path;
      this.logger.debug(`Using global wakatime-cli location: ${path}`);
    }

    return this.cliLocationGlobal;
  }

  /**
   * Checks if wakatime-cli is installed
   * @returns true if CLI binary exists at expected location
   */
  public isCliInstalled(): boolean {
    if (this.cliInstalled) return true;
    this.cliInstalled = fs.existsSync(this.getCliLocation());
    return this.cliInstalled;
  }

  /**
   * Checks if CLI is installed and up-to-date, installing/updating if needed
   * @param callback - Callback function to invoke after installation complete
   */
  public checkAndInstallCli(callback: () => void): void {
    if (!this.isCliInstalled()) {
      this.installCli(callback);
    } else {
      this.isCliLatest((isLatest) => {
        if (!isLatest) {
          this.installCli(callback);
        } else {
          callback();
        }
      });
    }
  }

  /**
   * Checks if the installed CLI is the latest version
   * Skips check for global installations (managed externally)
   * @param callback - Callback function receiving true if latest version
   */
  private isCliLatest(callback: (arg0: boolean) => void): void {
    // Don't update global installations
    if (this.getCliLocationGlobal()) {
      callback(true);
      return;
    }

    let args = ['--version'];
    const options = Desktop.buildOptions();
    try {
      child_process.execFile(this.getCliLocation(), args, options, (error, _stdout, stderr) => {
        if (!(error != null)) {
          let currentVersion = _stdout.toString().trim() + stderr.toString().trim();
          this.logger.debug(`Current wakatime-cli version is ${currentVersion}`);

          // Skip version check for local development builds
          if (currentVersion === '<local-build>') {
            callback(true);
            return;
          }

          // For legacy OS versions, check if we need specific version
          const tag = this.legacyReleaseTag();
          if (tag && currentVersion !== tag) {
            callback(false);
            return;
          }

          this.options.getSetting(
            'internal',
            'cli_version_last_accessed',
            true,
            (accessed: Setting) => {
              const now = Math.round(Date.now() / 1000);
              const lastAccessed = parseInt(accessed.value);
              const fourHours = 4 * 3600;
              
              // Only check for updates every 4 hours to avoid rate limiting
              if (lastAccessed && lastAccessed + fourHours > now) {
                this.logger.debug(
                  `Skip checking for wakatime-cli updates because recently checked ${
                    now - lastAccessed
                  } seconds ago.`,
                );
                callback(true);
                return;
              }

              this.logger.debug('Checking for updates to wakatime-cli...');
              this.getLatestCliVersion((latestVersion) => {
                if (currentVersion === latestVersion) {
                  this.logger.debug('wakatime-cli is up to date');
                  callback(true);
                } else if (latestVersion) {
                  this.logger.debug(`Found an updated wakatime-cli ${latestVersion}`);
                  callback(false);
                } else {
                  this.logger.debug('Unable to find latest wakatime-cli version');
                  callback(false);
                }
              });
            },
          );
        } else {
          callback(false);
        }
      });
    } catch (e) {
      callback(false);
    }
  }

  /**
   * Fetches the latest CLI version from GitHub API
   * @param callback - Callback function receiving version string (or empty on error)
   */
  /**
   * Fetches the latest CLI version from GitHub API
   * @param callback - Callback function receiving version string (or empty on error)
   */
  private getLatestCliVersion(callback: (arg0: string) => void): void {
    this.options.getSetting('settings', 'proxy', false, (proxy: Setting) => {
      this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify: Setting) => {
        let options = {
          url: this.githubReleasesUrl,
          json: true,
          headers: {
            'User-Agent': 'github.com/wakatime/vscode-wakatime',
          },
        };
        this.logger.debug(`Fetching latest wakatime-cli version from GitHub API: ${options.url}`);
        
        // Apply proxy settings if configured
        if (proxy.value) {
          this.logger.debug(`Using Proxy: ${proxy.value}`);
          options['proxy'] = proxy.value;
        }
        
        // Disable SSL verification if configured (for corporate proxies)
        if (noSSLVerify.value === 'true') options['strictSSL'] = false;
        
        try {
          request.get(options, (error, response, json) => {
            if (!error && response && response.statusCode == 200) {
              this.logger.debug(`GitHub API Response ${response.statusCode}`);
              const latestCliVersion = json['tag_name'];
              this.logger.debug(`Latest wakatime-cli version from GitHub: ${latestCliVersion}`);
              
              // Cache the timestamp to avoid rate limiting
              this.options.setSetting(
                'internal',
                'cli_version_last_accessed',
                String(Math.round(Date.now() / 1000)),
                true,
              );
              callback(latestCliVersion);
            } else {
              if (response) {
                this.logger.warn(`GitHub API Response ${response.statusCode}: ${error}`);
              } else {
                this.logger.warn(`GitHub API Response Error: ${error}`);
              }
              callback('');
            }
          });
        } catch (e) {
          this.logger.warnException(e);
          callback('');
        }
      });
    });
  }

  /**
   * Downloads and installs the wakatime-cli binary
   * @param callback - Callback function to invoke after installation
   */
  private installCli(callback: () => void): void {
    this.logger.debug(`Downloading wakatime-cli from GitHub...`);
    const url = this.cliDownloadUrl();
    let zipFile = path.join(this.resourcesLocation, 'wakatime-cli' + this.randStr() + '.zip');
    this.downloadFile(
      url,
      zipFile,
      () => {
        this.extractCli(zipFile, callback);
      },
      callback,
    );
  }

  /**
   * Checks if a file is a symbolic link
   * @param file - File path to check
   * @returns true if file is a symlink
   */
  private isSymlink(file: string): boolean {
    try {
      return fs.lstatSync(file).isSymbolicLink();
    } catch (_) {}
    return false;
  }

  /**
   * Extracts CLI from zip file and sets up permissions
   * @param zipFile - Path to downloaded zip file
   * @param callback - Callback function to invoke after extraction
   */
  private extractCli(zipFile: string, callback: () => void): void {
    this.logger.debug(`Extracting wakatime-cli into "${this.resourcesLocation}"...`);
    this.backupCli();
    this.unzip(zipFile, this.resourcesLocation, (unzipped) => {
      if (!unzipped) {
        this.restoreCli();
      } else if (!Desktop.isWindows()) {
        this.removeCli();
        const cli = this.getCliLocation();
        try {
          this.logger.debug('Chmod 755 wakatime-cli...');
          fs.chmodSync(cli, 0o755);
        } catch (e) {
          this.logger.warnException(e);
        }
        const ext = Desktop.isWindows() ? '.exe' : '';
        const link = path.join(this.resourcesLocation, `wakatime-cli${ext}`);
        if (!this.isSymlink(link)) {
          try {
            this.logger.debug(`Create symlink from wakatime-cli to ${cli}`);
            fs.symlinkSync(cli, link);
          } catch (e) {
            this.logger.warnException(e);
            try {
              fs.copyFileSync(cli, link);
              fs.chmodSync(link, 0o755);
            } catch (e2) {
              this.logger.warnException(e2);
            }
          }
        }
      }
      callback();
    });
    this.logger.debug('Finished extracting wakatime-cli.');
  }

  /**
   * Creates a backup of existing CLI binary before updating
   */
  private backupCli() {
    if (fs.existsSync(this.getCliLocation())) {
      fs.renameSync(this.getCliLocation(), `${this.getCliLocation()}.backup`);
    }
  }

  /**
   * Restores CLI from backup if installation fails
   */
  private restoreCli() {
    const backup = `${this.getCliLocation()}.backup`;
    if (fs.existsSync(backup)) {
      fs.renameSync(backup, this.getCliLocation());
    }
  }

  /**
   * Removes backup CLI after successful installation
   */
  private removeCli() {
    const backup = `${this.getCliLocation()}.backup`;
    if (fs.existsSync(backup)) {
      fs.unlinkSync(backup);
    }
  }

  /**
   * Downloads a file from URL to local path
   * @param url - URL to download from
   * @param outputFile - Local path to save file
   * @param callback - Success callback
   * @param error - Error callback
   */
  private downloadFile(
    url: string,
    outputFile: string,
    callback: () => void,
    error: () => void,
  ): void {
    this.options.getSetting('settings', 'proxy', false, (proxy: Setting) => {
      this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify: Setting) => {
        let options = { url: url };
        if (proxy.value) {
          this.logger.debug(`Using Proxy: ${proxy.value}`);
          options['proxy'] = proxy.value;
        }
        if (noSSLVerify.value === 'true') options['strictSSL'] = false;
        try {
          let r = request.get(options);
          r.on('error', (e) => {
            this.logger.warn(`Failed to download ${url}`);
            this.logger.warn(e.toString());
            error();
          });
          let out = fs.createWriteStream(outputFile);
          r.pipe(out);
          r.on('end', () => {
            out.on('finish', () => {
              callback();
            });
          });
        } catch (e) {
          this.logger.warnException(e);
          callback();
        }
      });
    });
  }

  /**
   * Extracts zip file to output directory
   * @param file - Path to zip file
   * @param outputDir - Directory to extract to
   * @param callback - Callback receiving true if successful
   */
  private unzip(file: string, outputDir: string, callback: (unzipped: boolean) => void): void {
    if (fs.existsSync(file)) {
      try {
        let zip = new adm_zip(file);
        zip.extractAllTo(outputDir, true);
        fs.unlinkSync(file);
        callback(true);
        return;
      } catch (e) {
        this.logger.warnException(e);
      }
      try {
        fs.unlinkSync(file);
      } catch (e2) {
        this.logger.warnException(e2);
      }
      callback(false);
    }
  }

  /**
   * Determines if current OS requires a legacy CLI version
   * Used for older macOS versions that need specific CLI builds
   * @returns CLI release tag for legacy OS, or undefined
   */
  private legacyReleaseTag() {
    const osname = this.osName() as osName;
    const legacyOS = this.legacyOperatingSystems[osname];
    if (!legacyOS) return;
    const version = legacyOS.find((spec) => {
      try {
        return semver.lt(os.release(), spec.kernelLessThan);
      } catch (e) {
        return false;
      }
    });
    return version?.tag;
  }

  /**
   * Gets normalized CPU architecture string for CLI binary
   * @returns Architecture string (386, amd64, arm64, etc.)
   */
  private architecture(): string {
    const arch = os.arch();
    if (arch.indexOf('32') > -1) return '386';
    if (arch.indexOf('x64') > -1) return 'amd64';
    return arch;
  }

  /**
   * Gets normalized OS name for CLI binary
   * @returns OS name string (darwin, windows, linux, etc.)
   */
  private osName(): string {
    let osname = os.platform() as string;
    if (osname == 'win32') osname = 'windows';
    return osname;
  }

  /**
   * Constructs download URL for appropriate CLI binary
   * Selects correct binary for OS, architecture, and legacy requirements
   * @returns GitHub download URL for CLI zip file
   */
  private cliDownloadUrl(): string {
    const osname = this.osName();
    const arch = this.architecture();

    // Use legacy wakatime-cli release to support older operating systems
    const tag = this.legacyReleaseTag();
    if (tag) {
      return `https://github.com/wakatime/wakatime-cli/releases/download/${tag}/wakatime-cli-${osname}-${arch}.zip`;
    }

    // List of officially supported OS-architecture combinations
    const validCombinations = [
      'android-amd64',
      'android-arm64',
      'darwin-amd64',
      'darwin-arm64',
      'freebsd-386',
      'freebsd-amd64',
      'freebsd-arm',
      'linux-386',
      'linux-amd64',
      'linux-arm',
      'linux-arm64',
      'netbsd-386',
      'netbsd-amd64',
      'netbsd-arm',
      'openbsd-386',
      'openbsd-amd64',
      'openbsd-arm',
      'openbsd-arm64',
      'windows-386',
      'windows-amd64',
      'windows-arm64',
    ];
    
    // Report to WakaTime if platform is not officially supported
    if (!validCombinations.includes(`${osname}-${arch}`))
      this.reportMissingPlatformSupport(osname, arch);

    return `${this.githubDownloadUrl}/wakatime-cli-${osname}-${arch}.zip`;
  }

  /**
   * Reports missing platform support to WakaTime API
   * Helps WakaTime team prioritize new platform support
   * @param osname - Operating system name
   * @param architecture - CPU architecture
   */
  private reportMissingPlatformSupport(osname: string, architecture: string): void {
    const url = `https://api.wakatime.com/api/v1/cli-missing?osname=${osname}&architecture=${architecture}&plugin=vscode`;
    this.options.getSetting('settings', 'proxy', false, (proxy: Setting) => {
      this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify: Setting) => {
        let options = { url: url };
        if (proxy.value) options['proxy'] = proxy.value;
        if (noSSLVerify.value === 'true') options['strictSSL'] = false;
        try {
          request.get(options);
        } catch (e) {}
      });
    });
  }

  /**
   * Generates a random string for temporary file names
   * @returns Random alphanumeric string
   */
  private randStr(): string {
    return (Math.random() + 1).toString(36).substring(7);
  }
}
