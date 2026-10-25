import passport from 'passport';
import { isValidObjectId } from 'mongoose';
import { UserModel } from '../models/user.js';

let configured = false;

/**
 * Session (de)serialization by the user's `_id`. Strategies (GitHub, S1) register on the
 * same global `passport` instance.
 */
export function configurePassport(): typeof passport {
  if (configured) return passport;
  configured = true;

  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });

  passport.deserializeUser((id: unknown, done) => {
    if (typeof id !== 'string' || !isValidObjectId(id)) {
      done(null, false);
      return;
    }
    UserModel.findById(id)
      .then((user) => done(null, user ?? false))
      .catch((err: unknown) => done(err));
  });

  return passport;
}
