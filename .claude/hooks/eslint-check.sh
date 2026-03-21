#!/bin/bash
# PostToolUse hook: run ESLint on edited TS/JS files and report errors to Claude
input=$(cat)
f=$(echo "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

# Only check TS/JS files
if ! echo "$f" | grep -qE '\.(ts|js|tsx|jsx)$'; then
  exit 0
fi

result=$(npx eslint "$f" 2>&1)
eslint_exit=$?

if [ $eslint_exit -eq 0 ]; then
  exit 0
fi

jq -n --arg msg "ESLint errors found in $f - please fix them before continuing:
$result" '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$msg}}'
