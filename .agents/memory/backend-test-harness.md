---
name: Backend source-package tests
description: Distinguishing test discovery/resolution failures from application failures in this workspace.
---

Use the established in-memory bundled test approach for backend regression suites importing workspace source packages.

**Why:** Native Node ESM rejected the workspace’s TypeScript directory imports before tests ran. Attempts to launch generated cache files also failed test discovery; the existing bundled CommonJS approach executed the same tests successfully. Those failures were harness failures, not payment failures.

**How to apply:** Verify that tests actually execute before interpreting a failed command as an application regression. Preserve bundling of workspace source packages when adapting the harness, and verify module resolution before replacing it with native TypeScript execution.
