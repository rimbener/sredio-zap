import cors from 'cors';
import express, { type Express, type Request } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { createSessionStore, SESSION_TTL_SECONDS } from './db.js';
import { getEnv, type Env } from './env.js';
import { errorHandler, notFoundHandler } from './errors/handler.js';
import { configurePassport } from './middleware/passport.js';
import type { UserDocument } from './models/user.js';
import { createApiRouter } from './routes/api/index.js';
import { authRouter } from './routes/auth.js';
import { webhooksRouter } from './routes/webhooks.js';

export const SESSION_COOKIE_NAME = 'zaps.sid';

export type CreateAppOptions = {
  /** Validated env; defaults to `getEnv()`. */
  env?: Env;
  /** Session store; defaults to connect-mongo on the shared Mongoose connection. */
  sessionStore?: session.Store;
  /**
   * **Test only.** Sets `req.user` right after `passport.session()` so `requireAuth` passes
   * without real OAuth. The production entry (`index.ts`) never passes it.
   */
  authenticateAs?: (req: Request) => UserDocument | null | Promise<UserDocument | null>;
};

/** Builds the Express app with the middleware chain in API.md → Middleware order. */
export function createApp(options: CreateAppOptions = {}): Express {
  const env = options.env ?? getEnv();
  const passport = configurePassport();
  const app = express();
  // Served over HTTPS (the callback URL is the server's public URL): mark the session cookie
  // `Secure` and trust the TLS-terminating proxy's `X-Forwarded-Proto`, which express-session
  // needs to set a `Secure` cookie. Plain-http localhost keeps both off.
  const secureCookie = new URL(env.GITHUB_CALLBACK_URL).protocol === 'https:';
  if (secureCookie) app.set('trust proxy', 1);

  // 1. Security headers
  app.use(helmet());
  // 2. CORS: only the Angular origin, with credentials
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  // 3. Webhook receiver (raw body for the HMAC check), before express.json()
  app.use('/webhooks', webhooksRouter);
  // 4. JSON bodies (Express default 100 KB limit)
  app.use(express.json());
  // 5. Session cookie `zaps.sid`, stored in Mongo
  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      store: options.sessionStore ?? createSessionStore(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
        maxAge: SESSION_TTL_SECONDS * 1000,
      },
    }),
  );
  // 6. Passport
  app.use(passport.initialize());
  app.use(passport.session());

  const { authenticateAs } = options;
  if (authenticateAs) {
    app.use(async (req, _res, next) => {
      const user = await authenticateAs(req);
      if (user) req.user = user;
      next();
    });
  }

  // 7. OAuth routes
  app.use('/auth', authRouter);
  // 8. JSON API: requireAuth, requireJson on POST/PATCH, then slice routes
  app.use('/api', createApiRouter());
  // 9. 404, then the error envelope
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
