import { Server } from 'socket.io';
export declare const setupWebSocket: (io: Server) => void;
export declare const emitToContest: (io: Server, contestId: string, event: string, data: any) => void;
export declare const emitToUser: (io: Server, userId: string, event: string, data: any) => void;
//# sourceMappingURL=websocket.d.ts.map