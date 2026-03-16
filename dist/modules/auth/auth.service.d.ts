import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
export declare class AuthService {
    private userModel;
    private jwtService;
    private readonly logger;
    private nonces;
    constructor(userModel: Model<User>, jwtService: JwtService);
    generateNonce(address: string): string;
    verify(address: string, signature: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: import("mongoose").Document<unknown, {}, User, {}, {}> & User & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    logout(refreshToken: string, userId: string): Promise<void>;
    private generatePlatformId;
}
