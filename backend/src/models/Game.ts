import { Schema, Types, model } from 'mongoose';

export type StoredGameStatus = 'active' | 'finished' | 'abandoned';
export type StoredGameResult = 'black' | 'white' | 'draw' | null;

const moveSchema = new Schema(
  {
    player: {
      type: String,
      enum: ['black', 'white'],
      required: true,
    },
    row: {
      type: Number,
      required: true,
      min: 0,
      max: 7,
    },
    col: {
      type: Number,
      required: true,
      min: 0,
      max: 7,
    },
    flipped: {
      type: [[Number]],
      default: [],
    },
    blackScore: {
      type: Number,
      required: true,
      min: 0,
    },
    whiteScore: {
      type: Number,
      required: true,
      min: 0,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const gameSchema = new Schema(
  {
    blackPlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    whitePlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    moves: {
      type: [moveSchema],
      default: [],
    },
    result: {
      type: String,
      enum: ['black', 'white', 'draw'],
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'finished', 'abandoned'],
      default: 'active',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    blackRatingChange: {
      type: Number,
      default: 0,
    },
    whiteRatingChange: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export interface IStoredMove {
  player: 'black' | 'white';
  row: number;
  col: number;
  flipped: [number, number][];
  blackScore: number;
  whiteScore: number;
  timestamp: Date;
}

export interface IGame {
  blackPlayer: Types.ObjectId;
  whitePlayer: Types.ObjectId;
  moves: IStoredMove[];
  result: StoredGameResult;
  status: StoredGameStatus;
  startTime: Date;
  endTime: Date | null;
  blackRatingChange: number;
  whiteRatingChange: number;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for common queries
gameSchema.index({ blackPlayer: 1, createdAt: -1 });
gameSchema.index({ whitePlayer: 1, createdAt: -1 });
gameSchema.index({ status: 1 });

export const Game = model<IGame>('Game', gameSchema);

