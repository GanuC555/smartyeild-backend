import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    getNonce(address: string): {
        nonce: string;
    };
    verify(body: {
        address: string;
        signature: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        user: import("mongoose").Document<unknown, {}, import("../../common/schemas/user.schema").User, {}, {}> & import("../../common/schemas/user.schema").User & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    logout(refreshToken: string, req: any): Promise<void>;
}
