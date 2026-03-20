"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const dotenv = require("dotenv");
dotenv.config();
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const defaultOrigins = [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:3001',
        'https://localhost:3001',
        'https://smartyeild-frontend.vercel.app',
    ];
    const extraOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : [];
    const allowedOrigins = [...new Set([...defaultOrigins, ...extraOrigins])];
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin))
                return callback(null, true);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Preflight', 'X-Requested-With', 'Accept'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true }));
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`\n🚀 OneYield Backend running on http://localhost:${port}`);
    console.log(`📦 Chain Adapter: ${process.env.CHAIN_ADAPTER || 'stub'}`);
    console.log(`🎬 Demo Mode: ${process.env.DEMO_MODE || 'false'}\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map