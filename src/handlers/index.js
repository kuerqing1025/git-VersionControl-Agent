// Import handlers from individual files
import {
  handleGitDirectoryStructure,
  handleGitReadFiles,
  handleGitSearchCode,
  handleGitLocalChanges,
} from "./directory-operations.js";
import {
  handleGitCommitHistory,
  handleGitCommitsDetails,
  handleGitCommit,
  handleGitTrack,
} from "./commit-operations.js";
import {
  handleGitBranchDiff,
  handleGitCheckoutBranch,
  handleGitDeleteBranch,
  handleGitMergeBranch,
} from "./branch-operations.js";
import {
  handleGitPush,
  handleGitPull,
  handleGitRemote,
} from "./remote-operations.js";
import { handleGitStash } from "./stash-operations.js";
import { handleGitCreateTag } from "./tag-operations.js";
import { handleGitRebase, handleGitReset } from "./advanced-operations.js";
import { handleGitConfig } from "./config-operations.js";
import {
  handleGitArchive,
  handleGitAttributes,
  handleGitBlame,
  handleGitClean,
  handleGitHooks,
  handleGitLFS,
  handleGitLFSFetch,
  handleGitRevert,
} from "./other-operations.js";

// Re-export all handlers
export {
  // Directory operations
  handleGitDirectoryStructure,
  handleGitReadFiles,
  handleGitSearchCode,
  handleGitLocalChanges,

  // Commit operations
  handleGitCommitHistory,
  handleGitCommitsDetails,
  handleGitCommit,
  handleGitTrack,

  // Branch operations
  handleGitBranchDiff,
  handleGitCheckoutBranch,
  handleGitDeleteBranch,
  handleGitMergeBranch,

  // Remote operations
  handleGitPush,
  handleGitPull,
  handleGitRemote,

  // Stash operations
  handleGitStash,

  // Tag operations
  handleGitCreateTag,

  // Advanced operations
  handleGitRebase,
  handleGitReset,

  // Config operations
  handleGitConfig,

  // Other operations
  handleGitArchive,
  handleGitAttributes,
  handleGitBlame,
  handleGitClean,
  handleGitHooks,
  handleGitLFS,
  handleGitLFSFetch,
  handleGitRevert,
};
