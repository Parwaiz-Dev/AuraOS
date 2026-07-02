"""Autonomy package — Fully Autonomous AI Restaurant OS (Milestone 10).

Provides observation, reasoning, decision-making, planning, approval,
and execution engines that coordinate all AI services autonomously.
"""

from app.autonomy.action_registry import (
    ActionDef,
    clear_actions,
    get_action,
    list_actions,
    register_action,
)
from app.autonomy.approval_engine import (
    approve,
    create_approval,
    get_pending,
    reject,
    reset_approvals,
)
from app.autonomy.autonomous_engine import (
    AutonomousEngine,
    get_autonomous_engine,
    reset_autonomous_engine,
)
from app.autonomy.confidence import compute_confidence, meets_threshold
from app.autonomy.decision_engine import DecisionEngine, get_decision_engine, reset_decision_engine
from app.autonomy.executor import Executor, get_executor
from app.autonomy.models import (
    ActionRecord,
    ActionStatus,
    ApprovalLevel,
    ApprovalRequest,
    AutonomyStatus,
    Decision,
    Observation,
    Plan,
    PlanStep,
    RiskLevel,
)
from app.autonomy.planner import Planner, get_planner
from app.autonomy.policy_engine import evaluate_policy, is_auto_executable
from app.autonomy.reasoning_engine import ReasoningEngine, get_reasoning_engine

__all__ = [
    "ActionDef",
    "ActionRecord",
    "ActionStatus",
    "ApprovalLevel",
    "ApprovalRequest",
    "AutonomousEngine",
    "AutonomyStatus",
    "Decision",
    "DecisionEngine",
    "Executor",
    "Observation",
    "Plan",
    "PlanStep",
    "Planner",
    "ReasoningEngine",
    "RiskLevel",
    "approve",
    "clear_actions",
    "compute_confidence",
    "create_approval",
    "evaluate_policy",
    "get_action",
    "get_autonomous_engine",
    "get_decision_engine",
    "get_executor",
    "get_pending",
    "get_planner",
    "get_reasoning_engine",
    "is_auto_executable",
    "list_actions",
    "meets_threshold",
    "register_action",
    "reject",
    "reset_approvals",
    "reset_autonomous_engine",
    "reset_decision_engine",
]
