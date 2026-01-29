import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        email: string;
        role: string;
    };
}
export declare const generateTokens: (payload: {
    id: string;
    username: string;
    email: string;
    role: string;
}) => {
    accessToken: never;
    refreshToken: string;
};
export declare const verifyToken: (token: string) => any;
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requireRole: (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map