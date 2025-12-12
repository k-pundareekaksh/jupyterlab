# Providers can break completions when isApplicable() raises

## Description

JupyterLab code completion uses multiple completion providers. Before fetching completions, the system checks which providers are applicable to the current context by calling each provider's `isApplicable()` method.

**The Problem:**

When a completion provider's `isApplicable()` method either:
- Rejects with an error, or
- Never resolves (hangs indefinitely)

The `applicableProviders()` method in `ProviderReconciliator` uses `Promise.all()` to wait for all provider checks. If any promise rejects, `Promise.all()` immediately rejects, causing the entire completion flow to fail silently. If any promise never resolves, `Promise.all()` waits indefinitely, causing the completer to hang permanently.

**Expected Behavior:**

The completion system must be resilient to provider failures. When a provider's `isApplicable()` method fails or times out:

1. The error should be logged to the console for debugging purposes
2. The failing provider should be excluded from the applicable providers list
3. Other providers should continue to work normally
4. The completion system should never hang indefinitely
5. The system should have a configurable timeout to prevent indefinite waiting

**Impact:**

This bug causes a poor user experience where:
- Code completion stops working entirely if any provider has a bug
- No error messages are shown, making debugging difficult
- The application appears frozen when providers hang
- Users cannot distinguish between "no completions available" and "completion system broken"

**Success Criteria:**

After the fix:
- Completion providers that fail or timeout are gracefully excluded
- Errors are visible in the browser console with clear provider identification
- The completion system continues to work with remaining healthy providers
- The system has a reasonable timeout (default - 2s) to prevent hanging
- Timeout timers are properly cleaned up to avoid resource leaks

## Language

TypeScript

## Category

Bug Fix / Error Handling

## Difficulty

Medium

## GitHub Repository

https://github.com/jupyterlab/jupyterlab

## Issue URL

https://github.com/jupyterlab/jupyterlab/issues/15441

## Commit Hash

_To be added: Commit hash after the fix is committed to the repository_