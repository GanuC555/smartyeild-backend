import { UserService } from './user.service';
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    getProfile(req: any): Promise<import("mongoose").FlattenMaps<import("../../common/schemas/user.schema").User> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getPortfolio(req: any): Promise<{
        totalPrincipal: string;
        totalYield: string;
        liquidBalance: string;
        strategyPool: string;
        totalValue: string;
        availableToSpend: string;
        blendedAPY: string;
        dailyEarnRate: string;
        perSecondEarnRate: string;
        positions: (import("mongoose").FlattenMaps<import("../../common/schemas/position.schema").Position> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
}
