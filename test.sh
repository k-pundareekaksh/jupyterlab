#!/bin/bash
set -e

case "$1" in
  base)
    cd packages/completer
    npm test -- --testPathIgnorePatterns=reconciliator.spec.ts
    ;;
  new)
    cd packages/completer
    npm test -- test/reconciliator.spec.ts
    ;;
  *)
    echo "Usage: ./test.sh {base|new}"
    exit 1
    ;;
esac