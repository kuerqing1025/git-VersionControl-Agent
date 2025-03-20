#!/usr/bin/env node
import { GitRepoBrowserServer } from "./server.js";

const server = new GitRepoBrowserServer();
server.run().catch(console.error);
