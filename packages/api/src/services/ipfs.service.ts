import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';

export interface IpfsPinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class IpfsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = 'https://api.pinata.cloud';
    this.apiKey = env.PINATA_API_KEY;
    this.secretKey = env.PINATA_SECRET_KEY;
  }

  private getHeaders(): Record<string, string> {
    return {
      'pinata_api_key': this.apiKey,
      'pinata_secret_api_key': this.secretKey
    };
  }

  /**
   * Upload a file to IPFS via Pinata
   */
  async uploadFile(
    filePath: string,
    fileName: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const url = `${this.baseUrl}/pinning/pinFileToIPFS`;

    const form = new FormData();
    form.append('file', require('fs').createReadStream(filePath));
    form.append('pinataMetadata', JSON.stringify({
      name: fileName
    }));
    if (metadata) {
      form.append('pinataContent', JSON.stringify(metadata));
    }

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          ...this.getHeaders()
        },
        maxContentLength: 30 * 1024 * 1024, // 30MB
        maxBodyLength: 30 * 1024 * 1024
      });

      const { IpfsHash } = response.data as IpfsPinResponse;
      logger.info('Uploaded to IPFS', { hash: IpfsHash, size: response.data.PinSize });
      return IpfsHash;
    } catch (error) {
      logger.error('IPFS upload failed', { error });
      throw new ApiError(502, ERROR_CODES.IPFS_UPLOAD_FAILED, 'IPFS upload failed');
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadJSON(data: Record<string, unknown>, name?: string): Promise<string> {
    const url = `${this.baseUrl}/pinning/pinJSONToIPFS`;

    try {
      const response = await axios.post(
        url,
        {
          pinataContent: data,
          pinataMetadata: name ? { name } : undefined
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.getHeaders()
          }
        }
      );

      const { IpfsHash } = response.data as IpfsPinResponse;
      logger.info('Uploaded JSON to IPFS', { hash: IpfsHash });
      return IpfsHash;
    } catch (error) {
      logger.error('IPFS JSON upload failed', { error });
      throw new ApiError(502, ERROR_CODES.IPFS_UPLOAD_FAILED, 'IPFS upload failed');
    }
  }

  /**
   * Fetch data from IPFS gateway
   */
  async fetchJSON<T>(cid: string): Promise<T> {
    const gateway = `${env.PINATA_GATEWAY_URL}/${cid}`;

    try {
      const response = await axios.get<T>(gateway, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new ApiError(404, ERROR_CODES.CERTIFICATE_NOT_FOUND, 'IPFS content not found');
      }
      logger.error('IPFS fetch failed', { error, cid });
      throw new ApiError(502, ERROR_CODES.IPFS_UPLOAD_FAILED, 'Failed to fetch from IPFS');
    }
  }

  /**
   * Generate gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    return `${env.PINATA_GATEWAY_URL}/${cid}`;
  }
}

export const ipfsService = new IpfsService();
