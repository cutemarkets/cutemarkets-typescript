import { CuteMarketsClient } from "cutemarkets-typescript";

export const client = new CuteMarketsClient({
  apiKey: process.env.CUTEMARKETS_API_KEY,
});
