/**
 * Stream Statistics Parser - Parse FFmpeg output for statistics
 */

export interface ParsedStatistics {
  frame?: number;
  fps?: number;
  bitrate?: number; // kbps
  size?: number; // kB
  time?: number; // seconds
  speed?: number;
  quality?: number;
  resolution?: string;
  codec?: string;
}

export class StreamStatisticsParser {
  // Static compiled regexes (optimization - compile once, reuse many times)
  private static readonly STATS_REGEX = /frame=\s*(\d+).*?fps=\s*([\d.]+).*?q=([\d.]+).*?size=\s*(\d+)\s*kB.*?time=(\d{2}):(\d{2}):(\d{2}\.\d{2}).*?bitrate=\s*([\d.]+)\s*kbits\/s.*?speed=\s*([\d.]+)x/;
  private static readonly FRAME_REGEX = /frame=\s*(\d+)/;
  private static readonly FPS_REGEX = /fps=\s*([\d.]+)/;
  private static readonly BITRATE_REGEX = /bitrate=\s*([\d.]+)\s*kbits\/s/;
  private static readonly TIME_REGEX = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/;
  private static readonly RESOLUTION_REGEX = /(\d{2,5}x\d{2,5})/;
  private static readonly CODEC_REGEX = /Video:\s*(\w+)/;

  /**
   * Parse FFmpeg stderr output line
   */
  // Cache numeric constants for performance (optimization - string operations optimization)
  private static readonly SECONDS_PER_HOUR = 3600;
  private static readonly SECONDS_PER_MINUTE = 60;
  private static readonly DECIMAL_RADIX = 10;

  static parseStderrLine(line: string): ParsedStatistics | null {
    // FFmpeg output format examples:
    // frame=  123 fps= 30 q=28.0 size=    1024kB time=00:00:04.10 bitrate=2048.0kbits/s speed=1.00x
    // frame=  456 fps= 29.9 q=28.0 size=    2048kB time=00:00:15.20 bitrate=2048.0kbits/s speed=1.00x

    // Optimized: Use static compiled regex (optimization - compile once, reuse many times)
    const match = line.match(this.STATS_REGEX);
    
    if (match) {
      // Parse time from match groups (use cached constants - optimization)
      const hours = parseInt(match[5], this.DECIMAL_RADIX);
      const minutes = parseInt(match[6], this.DECIMAL_RADIX);
      const seconds = parseFloat(match[7]);
      const time = hours * this.SECONDS_PER_HOUR + minutes * this.SECONDS_PER_MINUTE + seconds;
      
      return {
        frame: parseInt(match[1], this.DECIMAL_RADIX),
        fps: parseFloat(match[2]),
        quality: parseFloat(match[3]),
        size: parseInt(match[4], this.DECIMAL_RADIX),
        time: time,
        bitrate: parseFloat(match[8]),
        speed: parseFloat(match[9]),
      };
    }
    
    // Fallback: Try to parse individual components if full match fails
    // This handles cases where some fields might be missing
    const stats: ParsedStatistics = {};
    let hasStats = false;

    // Parse frame (use static compiled regex)
    const frameMatch = line.match(this.FRAME_REGEX);
    if (frameMatch) {
      stats.frame = parseInt(frameMatch[1], this.DECIMAL_RADIX);
      hasStats = true;
    }

    // Parse FPS (use static compiled regex)
    const fpsMatch = line.match(this.FPS_REGEX);
    if (fpsMatch) {
      stats.fps = parseFloat(fpsMatch[1]);
      hasStats = true;
    }

    // Parse bitrate (kbits/s) (use static compiled regex)
    const bitrateMatch = line.match(this.BITRATE_REGEX);
    if (bitrateMatch) {
      stats.bitrate = parseFloat(bitrateMatch[1]);
      hasStats = true;
    }

    // Parse time (HH:MM:SS.mmm) - most important for uptime (use static compiled regex)
    const timeMatch = line.match(this.TIME_REGEX);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], this.DECIMAL_RADIX);
      const minutes = parseInt(timeMatch[2], this.DECIMAL_RADIX);
      const seconds = parseFloat(timeMatch[3]);
      stats.time = hours * this.SECONDS_PER_HOUR + minutes * this.SECONDS_PER_MINUTE + seconds;
      hasStats = true;
    }

    // Parse resolution (from stream info) - less common in statistics lines (use static compiled regex)
    const resolutionMatch = line.match(this.RESOLUTION_REGEX);
    if (resolutionMatch) {
      stats.resolution = resolutionMatch[1];
    }

    // Parse codec - less common in statistics lines (use static compiled regex)
    const codecMatch = line.match(this.CODEC_REGEX);
    if (codecMatch) {
      stats.codec = codecMatch[1];
    }

    // Return stats if we found at least one metric
    return hasStats ? stats : null;
  }

  /**
   * Parse multiple lines of FFmpeg output
   */
  static parseStderrLines(lines: string[]): ParsedStatistics[] {
    const results: ParsedStatistics[] = [];

    for (const line of lines) {
      const stats = this.parseStderrLine(line);
      if (stats) {
        results.push(stats);
      }
    }

    return results;
  }

  /**
   * Get latest statistics from parsed results
   */
  static getLatest(parsed: ParsedStatistics[]): ParsedStatistics | null {
    if (parsed.length === 0) {
      return null;
    }

    // Return the last parsed statistics
    return parsed[parsed.length - 1];
  }

  /**
   * Calculate average statistics
   */
  static calculateAverage(parsed: ParsedStatistics[]): ParsedStatistics | null {
    if (parsed.length === 0) {
      return null;
    }

    const avg: ParsedStatistics = {};

    // Average FPS
    const fpsValues = parsed.filter((s) => s.fps !== undefined).map((s) => s.fps!);
    if (fpsValues.length > 0) {
      avg.fps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    }

    // Average bitrate
    const bitrateValues = parsed.filter((s) => s.bitrate !== undefined).map((s) => s.bitrate!);
    if (bitrateValues.length > 0) {
      avg.bitrate = bitrateValues.reduce((a, b) => a + b, 0) / bitrateValues.length;
    }

    // Average speed
    const speedValues = parsed.filter((s) => s.speed !== undefined).map((s) => s.speed!);
    if (speedValues.length > 0) {
      avg.speed = speedValues.reduce((a, b) => a + b, 0) / speedValues.length;
    }

    // Latest frame, time, size
    const latest = parsed[parsed.length - 1];
    if (latest.frame !== undefined) {
      avg.frame = latest.frame;
    }
    if (latest.time !== undefined) {
      avg.time = latest.time;
    }
    if (latest.size !== undefined) {
      avg.size = latest.size;
    }
    if (latest.resolution) {
      avg.resolution = latest.resolution;
    }
    if (latest.codec) {
      avg.codec = latest.codec;
    }

    return avg;
  }
}

