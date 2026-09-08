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
      uses: infrastructure-services/continuos-integration@net-mvc
      with:
        github_username: ${{ inputs.github_username }}
        github_token: ${{ inputs.github_token }}
        workdir_src: ${{ inputs.workdir_src }}
        workdir_test: ${{ inputs.workdir_test }}
        sentinel_url: ${{ inputs.sentinel_url }}
        sentinel_sensor_id: ${{ inputs.sentinel_sensor_id }}
        gitops_url: ${{ inputs.gitops_url }}
        scan_id: ${{ inputs.scan_id }}
        dotnet-version: '10.0.x'
        matrix_version: '24.x'
        fontawesome_token: ${{ inputs.fontawesome_token }}
        pnpm_version: '11.x'
        workdir_frontend: './src/front'
```

