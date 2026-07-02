"""Workflow base class — defines the step interface and workflow composition."""

from __future__ import annotations

import abc
import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.workflows.exceptions import (
    StepExecutionError,
    WorkflowCancelledError,
    WorkflowTimeoutError,
)
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_result import StepResult, WorkflowResult
from app.workflows.workflow_state import WorkflowState, can_transition

logger = logging.getLogger(__name__)


class WorkflowStep(abc.ABC):
    """Abstract base for all workflow steps."""

    name: str = "base_step"
    timeout_seconds: float = 300.0
    retries: int = 0

    @abc.abstractmethod
    async def execute(self, ctx: WorkflowContext) -> dict[str, Any]:
        ...

    async def rollback(self, ctx: WorkflowContext) -> None:
        pass

    def should_skip(self, ctx: WorkflowContext) -> bool:
        return False


class Workflow:
    """Orchestrates a sequence of steps with retry, timeout, and rollback."""

    workflow_id: str = ""
    name: str = "base_workflow"
    description: str = ""
    timeout_seconds: float = 600.0

    def __init__(self) -> None:
        if not self.workflow_id:
            self.workflow_id = self.name
        self._steps: list[WorkflowStep] = []
        self._parallel_groups: dict[str, list[WorkflowStep]] = {}
        self._state = WorkflowState.CREATED

    @property
    def state(self) -> WorkflowState:
        return self._state

    def add_step(self, step: WorkflowStep) -> None:
        self._steps.append(step)

    def add_parallel_steps(self, group: str, steps: list[WorkflowStep]) -> None:
        self._parallel_groups[group] = steps

    def get_steps(self) -> list[WorkflowStep]:
        return list(self._steps)

    def _transition(self, target: WorkflowState) -> None:
        if can_transition(self._state, target):
            self._state = target
        else:
            logger.warning(
                "Invalid state transition %s → %s for workflow %s",
                self._state.value, target.value, self.name,
            )

    async def run(self, ctx: WorkflowContext) -> WorkflowResult:
        """Execute all steps sequentially, with parallel groups inlined."""
        ctx.workflow_id = self.workflow_id
        ctx.mark_start()
        t0 = time.monotonic()

        result = WorkflowResult(
            workflow_id=self.workflow_id,
            execution_id=ctx.execution_id,
            workflow_name=self.name,
            restaurant_id=ctx.restaurant_id,
            started_at=ctx.timestamps.get("started_at", ""),
        )

        self._transition(WorkflowState.RUNNING)
        result.state = self._state.value

        executed_steps: list[WorkflowStep] = []

        try:
            for step in self._steps:
                if ctx.cancelled:
                    raise WorkflowCancelledError(f"Workflow {self.name} cancelled")

                elapsed = time.monotonic() - t0
                if elapsed > self.timeout_seconds:
                    raise WorkflowTimeoutError(f"Workflow {self.name} exceeded {self.timeout_seconds}s")

                step_result = await self._run_step(step, ctx)
                result.steps.append(step_result)
                executed_steps.append(step)

                if step_result.status == "failed" and not step_result.skipped:
                    raise StepExecutionError(step.name, step_result.error or "Unknown error")

            # Run parallel groups
            for group_name, group_steps in self._parallel_groups.items():
                if ctx.cancelled:
                    raise WorkflowCancelledError(f"Workflow {self.name} cancelled")

                parallel_results = await self._run_parallel(group_steps, ctx)
                result.steps.extend(parallel_results)
                executed_steps.extend(group_steps)

                for pr in parallel_results:
                    if pr.status == "failed" and not pr.skipped:
                        raise StepExecutionError(pr.step_name, pr.error or "Unknown error")

            self._transition(WorkflowState.SUCCESS)

        except WorkflowCancelledError:
            self._transition(WorkflowState.CANCELLED)
            result.errors.append("Workflow cancelled")
        except WorkflowTimeoutError:
            self._transition(WorkflowState.TIMEOUT)
            result.errors.append(f"Timeout after {self.timeout_seconds}s")
        except StepExecutionError as exc:
            self._transition(WorkflowState.FAILED)
            result.errors.append(str(exc))
            await self._rollback(executed_steps, ctx)
            if self._state == WorkflowState.FAILED:
                self._transition(WorkflowState.ROLLED_BACK)
        except Exception as exc:
            self._transition(WorkflowState.FAILED)
            result.errors.append(str(exc))

        ctx.mark_end()
        elapsed_ms = (time.monotonic() - t0) * 1000
        result.state = self._state.value
        result.duration_ms = round(elapsed_ms, 2)
        result.completed_at = ctx.timestamps.get("completed_at", "")
        result.data = dict(ctx.step_results)
        result.errors.extend(ctx.errors)
        return result

    async def _run_step(self, step: WorkflowStep, ctx: WorkflowContext) -> StepResult:
        if step.should_skip(ctx):
            return StepResult(step_name=step.name, status="skipped", skipped=True)

        t0 = time.monotonic()
        max_attempts = step.retries + 1
        last_error = ""

        for attempt in range(max_attempts):
            try:
                data = await asyncio.wait_for(
                    step.execute(ctx),
                    timeout=step.timeout_seconds,
                )
                ctx.set_step_result(step.name, data)
                elapsed = (time.monotonic() - t0) * 1000
                return StepResult(
                    step_name=step.name,
                    status="success",
                    data=data or {},
                    duration_ms=round(elapsed, 2),
                    retries=attempt,
                )
            except asyncio.TimeoutError:
                last_error = f"Step timed out after {step.timeout_seconds}s"
                logger.warning("Step %s timed out (attempt %d/%d)", step.name, attempt + 1, max_attempts)
            except Exception as exc:
                last_error = str(exc)
                logger.warning("Step %s failed (attempt %d/%d): %s", step.name, attempt + 1, max_attempts, exc)

            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5 * (2 ** attempt))

        elapsed = (time.monotonic() - t0) * 1000
        ctx.add_error(f"Step '{step.name}': {last_error}")
        return StepResult(
            step_name=step.name,
            status="failed",
            error=last_error,
            duration_ms=round(elapsed, 2),
            retries=max_attempts - 1,
        )

    async def _run_parallel(
        self, steps: list[WorkflowStep], ctx: WorkflowContext,
    ) -> list[StepResult]:
        tasks = [self._run_step(s, ctx) for s in steps]
        return list(await asyncio.gather(*tasks))

    async def _rollback(self, steps: list[WorkflowStep], ctx: WorkflowContext) -> None:
        for step in reversed(steps):
            try:
                await step.rollback(ctx)
            except Exception:
                logger.debug("Rollback failed for step %s", step.name, exc_info=True)
