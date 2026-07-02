"""Workflow package — AI Workflow Orchestration Engine (Milestone 9).

Provides reusable, composable workflows that coordinate all AI services
through a state-machine-based engine with retry, rollback, timeout,
cancellation, persistence, and event-bus integration.
"""

from app.workflows.workflow import Workflow, WorkflowStep
from app.workflows.workflow_context import WorkflowContext
from app.workflows.workflow_engine import WorkflowEngine, get_workflow_engine, reset_workflow_engine
from app.workflows.workflow_executor import WorkflowExecutor
from app.workflows.workflow_registry import (
    clear_registry,
    get_workflow_class,
    list_workflows,
    register_workflow,
)
from app.workflows.workflow_result import StepResult, WorkflowResult
from app.workflows.workflow_state import WorkflowState

__all__ = [
    "Workflow",
    "WorkflowStep",
    "WorkflowContext",
    "WorkflowEngine",
    "WorkflowExecutor",
    "WorkflowResult",
    "WorkflowState",
    "StepResult",
    "get_workflow_engine",
    "reset_workflow_engine",
    "register_workflow",
    "get_workflow_class",
    "list_workflows",
    "clear_registry",
]

# ── Register built-in workflows on import ────────────────────────────────────

from app.workflows.steps import (
    AnomalyDetectionStep,
    CollectDataStep,
    CopilotResponseStep,
    GenerateInsightsStep,
    GenerateRecommendationsStep,
    OrderForecastStep,
    PersistResultsStep,
    RAGSearchStep,
    RetrainModelsStep,
    RevenueForecastStep,
    SendNotificationsStep,
    UpdateRegistryStep,
)


# ── Workflow 1: Daily Analytics ──────────────────────────────────────────────

class DailyAnalyticsWorkflow(Workflow):
    workflow_id = "daily_analytics"
    name = "Daily Analytics"
    description = "Collect → Forecast → Anomalies → Insights → Recommendations → Notify → Persist"
    timeout_seconds = 600.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(CollectDataStep())
        self.add_step(RevenueForecastStep())
        self.add_step(OrderForecastStep())
        self.add_step(AnomalyDetectionStep())
        self.add_step(GenerateInsightsStep())
        self.add_step(GenerateRecommendationsStep())
        self.add_step(SendNotificationsStep())
        self.add_step(PersistResultsStep())


register_workflow(DailyAnalyticsWorkflow)


# ── Workflow 2: Model Retraining ─────────────────────────────────────────────

class ModelRetrainingWorkflow(Workflow):
    workflow_id = "model_retraining"
    name = "Model Retraining"
    description = "Collect Metrics → Detect Drift → Retrain → Register → Publish Event"
    timeout_seconds = 600.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(CollectDataStep())
        self.add_step(AnomalyDetectionStep())
        self.add_step(RetrainModelsStep())
        self.add_step(UpdateRegistryStep())
        self.add_step(PersistResultsStep())


register_workflow(ModelRetrainingWorkflow)


# ── Workflow 3: Inventory ────────────────────────────────────────────────────

class InventoryWorkflow(Workflow):
    workflow_id = "inventory_workflow"
    name = "Inventory Workflow"
    description = "Inventory Prediction → Stockout Detection → Purchase Advice → Notify"
    timeout_seconds = 300.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(CollectDataStep())
        self.add_step(GenerateInsightsStep())
        self.add_step(SendNotificationsStep())
        self.add_step(PersistResultsStep())


register_workflow(InventoryWorkflow)


# ── Workflow 4: Copilot ──────────────────────────────────────────────────────

class CopilotWorkflow(Workflow):
    workflow_id = "copilot_workflow"
    name = "Copilot Workflow"
    description = "Intent → Context → RAG → LLM → Explanation → Store"
    timeout_seconds = 120.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(RAGSearchStep())
        self.add_step(CopilotResponseStep())
        self.add_step(PersistResultsStep())


register_workflow(CopilotWorkflow)


# ── Workflow 5: Weekly AI Report ─────────────────────────────────────────────

class WeeklyReportWorkflow(Workflow):
    workflow_id = "weekly_report"
    name = "Weekly AI Report"
    description = "Analytics → Forecast → Insights → Recommendations → Email Report"
    timeout_seconds = 600.0

    def __init__(self) -> None:
        super().__init__()
        self.add_step(CollectDataStep())
        self.add_step(RevenueForecastStep())
        self.add_step(GenerateInsightsStep())
        self.add_step(GenerateRecommendationsStep())
        self.add_step(SendNotificationsStep())
        self.add_step(PersistResultsStep())


register_workflow(WeeklyReportWorkflow)
