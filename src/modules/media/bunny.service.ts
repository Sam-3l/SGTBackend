import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Talks to Bunny Storage (images/files) and Bunny Stream (video) over their
 * plain REST APIs - no official Bunny SDK exists, and axios is already a
 * project dependency, so this wraps the handful of endpoints we need
 * directly rather than pulling in a new package.
 */
@Injectable()
export class BunnyService {
  private readonly logger = new Logger(BunnyService.name);

  constructor(private readonly configService: ConfigService) {}

  private get storageBaseUrl(): string {
    const regionHost = this.configService.get<string>('bunnyStorageRegionHost');
    const zoneName = this.configService.get<string>('bunnyStorageZoneName');
    return `https://${regionHost}/${zoneName}`;
  }

  private get storageHeaders() {
    return { AccessKey: this.configService.get<string>('bunnyStorageAccessKey') };
  }

  private get streamHeaders() {
    return { AccessKey: this.configService.get<string>('bunnyStreamApiKey') };
  }

  private get streamLibraryId(): string {
    return this.configService.get<string>('bunnyStreamLibraryId');
  }

  /** Uploads a buffer to Bunny Storage under `key` and returns the full CDN URL. */
  async uploadToStorage(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    await axios.put(`${this.storageBaseUrl}/${key}`, buffer, {
      headers: { ...this.storageHeaders, 'Content-Type': contentType || 'application/octet-stream' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return this.buildStorageUrl(key);
  }

  buildStorageUrl(key: string): string {
    const pullZoneHostname = this.configService.get<string>('bunnyPullZoneHostname');
    return `https://${pullZoneHostname}/${key}`;
  }

  /** Best-effort delete - 404s are swallowed since the goal (asset gone) is already met. */
  async deleteFromStorage(key: string): Promise<void> {
    if (!key) return;

    try {
      await axios.delete(`${this.storageBaseUrl}/${key}`, { headers: this.storageHeaders });
    } catch (err) {
      if (err?.response?.status !== 404) {
        this.logger.warn(`Failed to delete Bunny Storage asset "${key}": ${err.message}`);
      }
    }
  }

  /** Extracts the storage key from a URL we previously returned via buildStorageUrl, or null if it isn't one of ours. */
  extractStorageKey(url: string): string | null {
    const pullZoneHostname = this.configService.get<string>('bunnyPullZoneHostname');
    if (!url || !pullZoneHostname) return null;

    const marker = `${pullZoneHostname}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;

    return decodeURIComponent(url.slice(idx + marker.length));
  }

  /** Creates a Bunny Stream video object and returns its GUID, ready to receive the binary upload. */
  async createStreamVideo(title: string): Promise<string> {
    const { data } = await axios.post(
      `https://video.bunnycdn.com/library/${this.streamLibraryId}/videos`,
      { title },
      { headers: { ...this.streamHeaders, 'Content-Type': 'application/json' } },
    );

    return data.guid;
  }

  async uploadStreamVideo(videoId: string, buffer: Buffer): Promise<void> {
    await axios.put(
      `https://video.bunnycdn.com/library/${this.streamLibraryId}/videos/${videoId}`,
      buffer,
      {
        headers: { ...this.streamHeaders, 'Content-Type': 'application/octet-stream' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );
  }

  /** Full iframe embed URL - the shape the handoff doc requires the frontend to receive, never a bare GUID. */
  buildStreamEmbedUrl(videoId: string): string {
    return `https://iframe.mediadelivery.net/embed/${this.streamLibraryId}/${videoId}`;
  }

  async deleteStreamVideo(videoId: string): Promise<void> {
    if (!videoId) return;

    try {
      await axios.delete(`https://video.bunnycdn.com/library/${this.streamLibraryId}/videos/${videoId}`, {
        headers: this.streamHeaders,
      });
    } catch (err) {
      if (err?.response?.status !== 404) {
        this.logger.warn(`Failed to delete Bunny Stream video "${videoId}": ${err.message}`);
      }
    }
  }

  /** Extracts the video GUID from an embed URL built by buildStreamEmbedUrl, or null if it isn't one of ours. */
  extractStreamVideoId(embedUrl: string): string | null {
    if (!embedUrl) return null;

    const match = embedUrl.match(/\/embed\/[^/]+\/([^/?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Deletes whatever asset a stored URL points to, inferring Storage vs.
   * Stream from the URL shape. A no-op for URLs we didn't produce ourselves
   * (e.g. pre-migration Cloudinary URLs still sitting on old rows) - there's
   * nothing of ours to delete in that case.
   */
  async deleteAssetByUrl(url: string): Promise<void> {
    if (!url) return;

    const videoId = this.extractStreamVideoId(url);
    if (videoId) {
      await this.deleteStreamVideo(videoId);
      return;
    }

    const key = this.extractStorageKey(url);
    if (key) await this.deleteFromStorage(key);
  }
}
