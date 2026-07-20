#!/usr/bin/env bash
# QE Pyramid Audit — run from your project root (e.g. pointage/)
# Usage: bash qe_audit.sh

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[0;33m"; NC="\033[0m"
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
miss() { echo -e "${RED}❌ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo "=== 1. Static analysis (ESLint / type checkers) ==="
[ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f .eslintrc.cjs ] || find . -maxdepth 3 -name "eslint.config.*" 2>/dev/null | grep -q . \
  && ok "ESLint config found" || miss "No ESLint config found"
find . -maxdepth 3 -iname "tsconfig.json" 2>/dev/null | grep -q . && ok "TypeScript config found" || warn "No tsconfig.json (JS-only, expected if not using TS)"

echo -e "\n=== 2. Unit tests ==="
find . -path ./node_modules -prune -o \( -name "test_*.py" -o -name "*_test.py" -o -name "*.test.js" -o -name "*.spec.js" \) -print 2>/dev/null | grep -q . \
  && ok "Unit test files found" || miss "No unit test files found"

echo -e "\n=== 3. Integration tests ==="
grep -rl "real_cross_service" --include="*.py" . 2>/dev/null | grep -q . \
  && ok "Integration tests (real_cross_service marker) found" || miss "No real_cross_service marker found"
find . -path ./node_modules -prune -o -iname "pytest.ini" -print -o -iname "pyproject.toml" -print 2>/dev/null | xargs grep -l "markers" 2>/dev/null | grep -q . \
  && ok "Pytest markers configured" || warn "No pytest markers config found"

echo -e "\n=== 4. E2E / UI tests (Cypress / Playwright) ==="
[ -d cypress ] || [ -f cypress.config.js ] || [ -f cypress.config.ts ] \
  && ok "Cypress found" || miss "No Cypress config found"
[ -d e2e ] || [ -f playwright.config.js ] || [ -f playwright.config.ts ] \
  && ok "Playwright found" || miss "No Playwright config found"

echo -e "\n=== 5. Contract tests (Pact or similar) ==="
grep -rl "pact" --include="*.json" --include="*.py" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -q . \
  && ok "Pact / contract test references found" || miss "No contract testing setup found"

echo -e "\n=== 6. Performance / load testing (k6, Locust) ==="
find . -path ./node_modules -prune -o -iname "locustfile.py" -print -o -iname "*.k6.js" -print 2>/dev/null | grep -q . \
  && ok "Locust or k6 found" || miss "No load testing setup found"

echo -e "\n=== 7. Security testing (SAST/DAST, dependency scanning) ==="
find . -maxdepth 3 -iname ".bandit" -o -iname "bandit.yaml" 2>/dev/null | grep -q . && ok "Bandit config found" || miss "No Bandit (Python SAST) config"
grep -rl "npm audit\|pip-audit\|safety check\|trivy\|snyk" --include="*.yml" --include="*.yaml" .github 2>/dev/null | grep -q . \
  && ok "Dependency/security scanning found in CI" || miss "No security scanning step in CI"

echo -e "\n=== 8. Test coverage gates ==="
grep -rl "fail_under\|--cov-fail-under\|coverageThreshold" --include="*.py" --include="*.cfg" --include="*.ini" --include="*.toml" --include="*.json" --include="*.yml" . 2>/dev/null | grep -v node_modules | grep -q . \
  && ok "Coverage gate found" || miss "No coverage threshold found"

echo -e "\n=== 9. Production monitoring (GlitchTip / Sentry SDK) ==="
grep -rl "glitchtip\|sentry_sdk\|@sentry" --include="*.py" --include="*.js" --include="requirements*.txt" --include="package.json" . 2>/dev/null | grep -v node_modules | grep -q . \
  && ok "GlitchTip/Sentry SDK found" || miss "No error monitoring SDK found"

echo -e "\n=== 10. CI/CD gates ==="
if [ -d .github/workflows ]; then
  ok ".github/workflows found"
  grep -rl "continue-on-error: true" .github/workflows 2>/dev/null | grep -q . \
    && warn "Some CI steps are non-blocking (continue-on-error: true) — check which"
else
  miss "No .github/workflows found"
fi

echo -e "\n=== 11. Branch protection / PR process ==="
warn "Cannot check from local files — verify manually via: gh api repos/:owner/:repo/branches/develop/protection"

echo -e "\n=== Done ==="