'use client';

import { useParams, useRouter } from 'next/navigation';
import { useClub, useClubMembers, useJoinClub, useLeaveClub, useDeleteClub } from '@/lib/hooks/useClubs';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useStudentMemberships } from '@/lib/hooks/useStudent';
import { MembershipWithClub } from '@/types/api.types';
import Header from '@/components/layout/Header';
import ClubInviteSection from '@/components/clubs/ClubInviteSection';
import EventsTab from '@/components/clubs/EventsTab';
import ChatTab from '@/components/clubs/ChatTab';
import ReviewsTab from '@/components/clubs/ReviewsTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ArrowLeft, Trash2, Info, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;
  
  const { user, isAuthenticated } = useAuth();
  const { data: club, isLoading } = useClub(clubId);
  const { data: members } = useClubMembers(clubId, 'active');
  const { data: memberships } = useStudentMemberships(user?.studentId || '');
  const { mutate: joinClub, isPending: isJoining } = useJoinClub();
  const { mutate: leaveClub, isPending: isLeaving } = useLeaveClub();
  const { mutate: deleteClub, isPending: isDeleting } = useDeleteClub();
  
  const membership = memberships?.find((m: MembershipWithClub) => m.clubId === clubId);
  const isJoined = membership?.status === 'active';
  const isPendingRequest = membership?.status === 'pending';
  const isAdmin = club?.adminStudentId === user?.studentId;
  const actionLabel = isJoining || isLeaving
    ? 'Loading...'
    : isJoined
    ? 'Leave Club'
    : isPendingRequest
    ? 'Request Pending'
    : membership?.status === 'rejected'
    ? 'Request Again'
    : 'Request to Join';

  const handleJoinLeave = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isJoined && user) {
      leaveClub({ clubId, studentId: user.studentId });
    } else if (!isPendingRequest) {
      joinClub(clubId);
    }
  };

  const handleDeleteClub = () => {
    deleteClub(clubId, {
      onSuccess: () => {
        router.push('/');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
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
      
      <div className="container px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Cover Image */}
        <div className="relative h-64 rounded-lg overflow-hidden mb-8">
          <img
            src={club.coverPhotoUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80'}
            alt={club.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur">
              {club.category}
            </Badge>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{club.name}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{club.memberCount} members</span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className={`grid w-full ${isJoined ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                {isJoined && (
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                       <Info className="h-5 w-5" />
                       About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {club.description || 'No description available.'}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="events" className="mt-6">
                <EventsTab clubId={clubId} isAdmin={isAdmin} />
              </TabsContent>
              
              <TabsContent value="members" className="mt-6">
                {members && members.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Members ({members.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {members.map((member) => (
                          <div key={member.studentId} className="flex items-center gap-3">
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
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                   <p className="text-muted-foreground">No members found.</p>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsTab clubId={clubId} />
              </TabsContent>

              {isJoined && (
                <TabsContent value="chat" className="mt-6">
                  <ChatTab clubId={clubId} />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Button
                  className="w-full"
                  variant={isJoined ? "outline" : "default"}
                  onClick={handleJoinLeave}
                  disabled={isJoining || isLeaving || isPendingRequest}
                >
                  {actionLabel}
                </Button>
                {isAdmin && (
                  <>
                    <Button 
                      className="w-full mt-2" 
                      variant="secondary"
                      onClick={() => router.push(`/clubs/${clubId}/manage`)}
                    >
                      Manage Club
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full mt-2" variant="destructive" disabled={isDeleting}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          {isDeleting ? 'Deleting...' : 'Delete Club'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the club
                            &quot;{club?.name}&quot; and remove all members, events, and associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteClub} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Club
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Invite Section - Only visible to admin */}
            {isAdmin && <ClubInviteSection clubId={clubId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
