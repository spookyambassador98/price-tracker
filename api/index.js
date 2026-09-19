import { createApp } from "../server/dist/app.js";

const app = createApp();

export const config = {
  maxDuration: 60,
  memory: 1024,
};

export default app;
