import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { verifyPersonalMessageSignature } from '@onelabs/sui/verify';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // In-memory nonce store (Redis in production)
  private nonces = new Map<string, { nonce: string; expires: number }>();

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  generateNonce(address: string): string {
    const nonce = [
      'OneYield&Spend Sign-In',
      `Address: ${address}`,
      `Nonce: ${crypto.randomBytes(16).toString('hex')}`,
      `Timestamp: ${Date.now()}`,
    ].join('\n');

    this.nonces.set(address.toLowerCase(), {
      nonce,
      expires: Date.now() + 5 * 60 * 1000, // 5 min
    });
    return nonce;
  }

  async verify(address: string, signature: string) {
    const stored = this.nonces.get(address.toLowerCase());
    if (!stored || stored.expires < Date.now()) {
      throw new UnauthorizedException('Nonce expired or not found');
    }

    // Verify Sui Ed25519 signature against stored nonce
    // Use 400 (not 401) so the frontend api client doesn't trigger the refresh/redirect flow
    try {
      await verifyPersonalMessageSignature(
        new TextEncoder().encode(stored.nonce),
        signature,
        { address },
      );
    } catch (err) {
      this.logger.error(`Signature verification failed: ${err}`);
      throw new BadRequestException('Invalid signature — make sure you are signing with the correct wallet');
    }
    this.nonces.delete(address.toLowerCase()); // prevent replay

    let user = await this.userModel.findOne({
      walletAddress: address.toLowerCase(),
    });
    if (!user) {
      user = await this.userModel.create({
        walletAddress: address.toLowerCase(),
        platformId: this.generatePlatformId(),
      });
    }

    const payload = {
      sub: user._id.toString(),
      address: user.walletAddress,
      platformId: user.platformId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift(); // keep latest 5
    await user.save();

    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret:
          process.env.JWT_SECRET || 'smartyield_jwt_secret_hackathon_2024',
      });
      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const newPayload = {
        sub: user._id.toString(),
        address: user.walletAddress,
        platformId: user.platformId,
      };
      return {
        accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string, userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  private generatePlatformId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'OYS-';
    for (let i = 0; i < 4; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
}
