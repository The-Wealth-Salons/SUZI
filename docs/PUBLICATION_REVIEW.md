# Public repository disclosure protocol (SUZI pilot)

This protocol applies **before first public push**, when opening/updating a PR, before merge, and during post-merge review. It implements a public-code application of The Wealth Salons' private Trust & Publication governance without publishing internal policy discussions.

## Prior to the first public push

Review proposed public artifacts, filenames, metadata, commit history, image contents, PR title/body, and generated material. Remove personal or beneficiary data, family photographs, private agent instructions, privileged partner material, secret values, internal operational strategy, and unapproved statements. Do not publish a private branch history into a public repository. If source material needs confidential discussion, draft in an approved private workspace and export only approved public code/assets.

## At PR opening and every new commit

Use the repository PR disclosure template. Run automated tests and separate credential/secret scanning, and obtain semantic review of public claims and wording. Automated scanner green means only limited patterns passed; it does not mean publication is approved. Do not include sensitive findings or links in public comments, logs, or PR descriptions.

## Before merge

Require a reviewer to confirm the **final commit SHA and whole diff**, with a recorded publication disposition and rights/claim review. The PR is held if evidence is insufficient. Owner retains merge authority.

## After merge

Keep ordinary safe technical PRs public. Consider PR-archive only with owner approval when the conversation should cease to be visible. Archiving hides a PR discussion and makes it read-only, but does **not** retract the underlying branch, commit history, forks, caches, or previous copies. Never treat archive as leak remediation. An exposure requires private incident handling, credential rotation where relevant, and coordinated GitHub history/support/fork remediation as warranted.

**No automatic archival or deletion is authorized by this document.**