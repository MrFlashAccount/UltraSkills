.PHONY: test test-workflow-e2e validate workflow-validate check-workflow-run-leaks

TEST_FILES := $(shell find lib/tests lib/entities lib/use-cases -name '*.test.mjs' -type f ! -path 'lib/tests/E2E/*' | sort)
WORKFLOW_E2E_TEST_FILES := lib/tests/E2E/*.test.mjs
TEST_BUN := AGENT=1 bun test --timeout=30000
DEFAULT_WORKFLOW_RUNS_ROOT := $(HOME)/.orbita/workflow-runs/v1

# Cheap guard: tests must not leak workflow run artifacts into repository paths.
check-workflow-run-leaks:
	@if [ -e .workflow-runs ] || [ -e ../../develop/.workflow-runs ]; then \
		echo "test leaked workflow run artifacts into the worktree" >&2; \
		exit 1; \
	fi
	@leak=$$(find "$(DEFAULT_WORKFLOW_RUNS_ROOT)" -mindepth 1 -maxdepth 1 -type d \( \
		-name 'workflow-runner-test-*' -o \
		-name 'workflow-runner-reuse-hints-*' -o \
		-name 'workflow-runner-fairness-*' -o \
		-name 'workflow-runner-pointer-*' -o \
		-name 'persisted-state-test-*' -o \
		-name 'workflow-e2e-*' -o \
		-name 'binding-*' \
	\) -print -quit 2>/dev/null); \
	if [ -n "$$leak" ]; then \
		echo "test leaked workflow run artifacts into $(DEFAULT_WORKFLOW_RUNS_ROOT): $$leak" >&2; \
		exit 1; \
	fi

test:
	@$(TEST_BUN) $(TEST_FILES); \
	status=$$?; \
	$(MAKE) --no-print-directory check-workflow-run-leaks || status=$$?; \
	exit $$status

test-workflow-e2e:
	@$(TEST_BUN) $(WORKFLOW_E2E_TEST_FILES); \
	status=$$?; \
	$(MAKE) --no-print-directory check-workflow-run-leaks || status=$$?; \
	exit $$status

workflow-validate:
	bun ./lib/entrypoints/cli/validate-workflow.mjs ../../workflows

validate: test workflow-validate
