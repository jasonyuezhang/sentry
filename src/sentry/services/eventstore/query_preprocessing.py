from collections.abc import Sequence

from sentry.models.groupredirect import GroupRedirect
from sentry.utils.query import Q


def get_all_merged_group_ids(group_ids: Sequence[str | int]) -> Sequence[str | int]:
    all_related_rows = GroupRedirect.objects.filter(
        Q(group_id__in=group_ids) | Q(previous_group_id__in=group_ids)
    ).values_list("group_id", "previous_group_id")
    out = set(group_ids)
    for r in all_related_rows:
        out.union(r.values())
    return out
