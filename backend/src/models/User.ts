import bcrypt from 'bcryptjs';
import { HydratedDocument, Model, Schema, model } from 'mongoose';

export interface IUser {
  username: string;
  email: string;
  passwordHash: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(password: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, UserMethods>;
export type UserModel = Model<IUser, Record<string, never>, UserMethods>;

const userSchema = new Schema<IUser, UserModel, UserMethods>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      default: 1200,
      min: 100,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
    wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.methods.comparePassword = function comparePassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Index for leaderboard sorting
userSchema.index({ rating: -1, wins: -1, username: 1 });

export const User = model<IUser, UserModel>('User', userSchema);
