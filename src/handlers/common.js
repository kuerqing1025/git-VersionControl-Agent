import path from "path";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import { exec } from "child_process";
import { promisify } from "util";
import { cloneRepo, getDirectoryTree } from "../utils/git.js";

const execPromise = promisify(exec);

export { path, fs, simpleGit, execPromise, cloneRepo, getDirectoryTree };
