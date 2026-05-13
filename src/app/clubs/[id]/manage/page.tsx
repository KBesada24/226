'use client';

import { useParams, useRouter } from 'next/navigation';
import { useClub, useClubMembers, useUpdateMembershipStatus } from '@/lib/hooks/useClubs';
import { useAuth } from '@/lib/contexts/AuthContext';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check, X, Users, UserCheck, Settings, Calendar } from 'lucide-react';
import { MemberWithStudent } from '@/types/api.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsTab from '@/components/clubs/EventsTab';
import ClubSettingsTab from '@/components/clubs/ClubSettingsTab';

export default function ClubManagePage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;
  
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: club, isLoading: clubLoading } = useClub(clubId);
  const { data: pendingMembers, isLoading: pendingLoading } = useClubMembers(clubId, 'pending');
  const { data: activeMembers, isLoading: activeLoading } = useClubMembers(clubId, 'active');
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMembershipStatus();

  if (!authLoading && !isAuthenticated) {
    router.push('/login');
    return null;
  }

  // Redirect if not the creator of this club
  if (club && (!user || club.adminStudentId !== user.studentId)) {
    router.push(`/clubs/${clubId}`);
    return null;
  }

  const handleUpdateStatus = (studentId: string, status: 'active' | 'rejected') => {
    updateStatus({ clubId, studentId, status });
  };

  if (authLoading || clubLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-10 w-1/3 mb-8" />
          <Skeleton className="h-64 w-full mb-8" />
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <p>Club not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Club
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Manage {club.name}</h1>
          <p className="text-muted-foreground">Manage your club's memberships, events, and settings</p>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
              {pendingMembers && pendingMembers.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {pendingMembers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-8">
            {/* Pending Requests */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <CardTitle>Member Requests</CardTitle>
                </div>
                <CardDescription>
                  Review and approve students who want to join your club
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !pendingMembers || pendingMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending requests
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingMembers.map((member: MemberWithStudent) => (
                      <div
                        key={member.studentId}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {member.student.firstName[0]}{member.student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.student.firstName} {member.student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.student.email}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleUpdateStatus(member.studentId, 'rejected')}
                            disabled={isUpdating}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(member.studentId, 'active')}
                            disabled={isUpdating}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>Active Members ({activeMembers?.length || 0})</CardTitle>
                </div>
                <CardDescription>
                  View all current members of your club
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !activeMembers || activeMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active members
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeMembers.map((member: MemberWithStudent) => (
                      <div
                        key={member.studentId}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {member.student.firstName[0]}{member.student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.student.firstName} {member.student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.student.email}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs font-normal">
                          Joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Unknown'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <EventsTab clubId={clubId} isAdmin={true} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
             <ClubSettingsTab club={club} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
