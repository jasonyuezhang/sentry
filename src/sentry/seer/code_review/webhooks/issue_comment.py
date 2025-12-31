"""
Handler for GitHub issue_comment webhook events.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry import options
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..permissions import has_code_review_enabled
from ..utils import record_error, record_outcome

logger = logging.getLogger(__name__)


class ErrorStatus(enum.StrEnum):
    MISSING_INTEGRATION = "missing_integration"
    REACTION_FAILED = "reaction_failed"


class Log(enum.StrEnum):
    MISSING_INTEGRATION = "github.webhook.issue_comment.missing-integration"
    REACTION_FAILED = "github.webhook.issue_comment.reaction-failed"


SENTRY_REVIEW_COMMAND = "@sentry review"


def is_pr_review_command(comment_body: str | None) -> bool:
    if comment_body is None:
        return False
    return SENTRY_REVIEW_COMMAND in comment_body.lower()


def _add_eyes_reaction_to_comment(
    integration: RpcIntegration | None,
    organization: Organization,
    repo: Repository,
    comment_id: str,
) -> None:
    extra = {"organization_id": organization.id, "repo": repo.name, "comment_id": comment_id}
    github_event = GithubWebhookType.ISSUE_COMMENT

    if integration is None:
        record_error(github_event, ErrorStatus.MISSING_INTEGRATION.value)
        logger.warning(
            Log.MISSING_INTEGRATION.value,
            extra=extra,
        )
        return

    try:
        client = integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment_reaction(repo.name, comment_id, GitHubReaction.EYES)
        record_outcome(github_event, "reaction_added")
    except Exception:
        record_error(github_event, ErrorStatus.REACTION_FAILED.value)
        logger.exception(
            Log.REACTION_FAILED.value,
            extra=extra,
        )


def handle_issue_comment_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    comment = event.get("comment", {})
    comment_id = comment.get("id")
    comment_body = comment.get("body")

    if not has_code_review_enabled(organization):
        return

    if not is_pr_review_command(comment_body or ""):
        return

    if not options.get("github.webhook.issue-comment"):
        if comment_id:
            _add_eyes_reaction_to_comment(integration, organization, repo, str(comment_id))

        from .task import schedule_task

        schedule_task(
            github_event=github_event,
            event=event,
            organization=organization,
            repo=repo,
        )
