'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Notification {
  notificationId: string;
  title: string;
  message: string;
  read: boolean;
  isRead?: boolean;
  type: string;
  metadata: any;
  createdAt: string;
}

export default function HeaderNotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!user) return [];
      return apiClient.get<Notification[]>('/notifications');
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s
  });

  const { mutate: markRead } = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const isUnread = (notification: Notification) => !(notification.isRead ?? notification.read);
  const unreadCount = notifications?.filter(isUnread).length || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (isUnread(notification)) {
      markRead(notification.notificationId);
    }
    
    if (notification.type === 'event_invite' && notification.metadata?.clubId) {
      router.push(`/clubs/${notification.metadata.clubId}`);
      setOpen(false);
    } else if (notification.type === 'membership_update' && notification.metadata?.clubId) {
      router.push(`/clubs/${notification.metadata.clubId}/manage`);
      setOpen(false);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-3 w-3 bg-destructive rounded-full border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!notifications || notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.notificationId}
                className={`p-3 cursor-pointer ${isUnread(n) ? 'bg-muted/50 font-medium' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="space-y-1">
                  <p className="text-sm leading-none">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {isUnread(n) && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
