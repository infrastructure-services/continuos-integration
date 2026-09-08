# continuos-integration

## React CI GitHub Action

Composite GitHub Action to run lint, build, test and coverage for React/JS projects.

### Inputs (high-level)

- `matrix_version` (required): Node.js version to use.
- `packages_token` (optional): GitHub Packages token for private packages.
- `pnpm_version` (optional): pnpm version to install when using pnpm.
- `workdir` (optional, default `.`): Directory where the action runs commands (install, lint, build, test). Keep default `.` for retro-compatibility.


### Example usage

```yaml
uses: infrastructure-services/continuos-integration@net-10-mvc
with:
	matrix_version: "24.x"
	packages_token: ${{ secrets.PACKAGES_TOKEN }}
	pnpm_version: "11.x"
	workdir: "./src/front" # With the WinMVC template its required to set workdir to the frontend folder, otherwise the action will fail.
    github_username: ${{ secrets.GITHUB_USERNAME }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

