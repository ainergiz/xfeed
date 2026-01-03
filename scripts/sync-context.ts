/**
 * Sync reference repos to .context/repos for AI context
 * Reads conductor.json and clones/updates configured repos
 */

import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface RepoConfig {
  name: string;
  url: string;
  description?: string;
}

interface ConductorConfig {
  context?: {
    repos?: RepoConfig[];
  };
}

const CONTEXT_DIR = ".context/repos";

async function syncRepo(repo: RepoConfig): Promise<void> {
  const repoPath = join(CONTEXT_DIR, repo.name);

  if (existsSync(repoPath)) {
    // Update existing repo
    console.log(`Updating ${repo.name}...`);
    try {
      await $`git -C ${repoPath} fetch --depth 1 origin`.quiet();
      await $`git -C ${repoPath} reset --hard origin/HEAD`.quiet();
      console.log(`  ✓ ${repo.name} updated`);
    } catch (error) {
      console.error(`  ✗ Failed to update ${repo.name}:`, error);
    }
  } else {
    // Clone new repo
    console.log(`Cloning ${repo.name}...`);
    try {
      await $`git clone --depth 1 ${repo.url} ${repoPath}`.quiet();
      console.log(`  ✓ ${repo.name} cloned`);
    } catch (error) {
      console.error(`  ✗ Failed to clone ${repo.name}:`, error);
    }
  }
}

async function main(): Promise<void> {
  // Read conductor.json
  const configPath = join(process.cwd(), "conductor.json");
  if (!existsSync(configPath)) {
    console.log("No conductor.json found, skipping context sync");
    return;
  }

  const config: ConductorConfig = await Bun.file(configPath).json();
  const repos = config.context?.repos ?? [];

  if (repos.length === 0) {
    console.log("No repos configured in conductor.json");
    return;
  }

  // Ensure .context/repos exists
  await $`mkdir -p ${CONTEXT_DIR}`.quiet();

  console.log(`Syncing ${repos.length} reference repos to ${CONTEXT_DIR}/\n`);

  // Sync all repos
  for (const repo of repos) {
    await syncRepo(repo);
  }

  console.log("\nContext repos synced!");
}

main().catch(console.error);
