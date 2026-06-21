import { useSecretInbox } from '@/hooks/useSecretMessages';

export function useSecretMessagesBadge(revealed: boolean) {
  const { data: inbox } = useSecretInbox({ enabled: revealed });
  const unreadCount = (inbox ?? []).filter((m) => !m.read_at).length;
  return { unreadCount, hasUnread: unreadCount > 0 };
}
