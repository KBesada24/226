'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useJoinViaInvite } from '@/lib/hooks/useClubs';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function InviteJoinPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token as string;
  
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { mutate: joinViaInvite, isPending, isSuccess, isError, error } = useJoinViaInvite();

  useEffect(() => {
    // If not authenticated, redirect to login with return URL
    if (!authLoading && !isAuthenticated) {
      const returnUrl = `/invites/${token}`;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [isAuthenticated, authLoading, token, router]);

  useEffect(() => {
    // Auto-join when authenticated and not already processing
    if (isAuthenticated && !isPending && !isSuccess && !isError) {
      joinViaInvite(token, {
        onSuccess: (data) => {
          // Redirect to club page after successful join
          setTimeout(() => {
            router.push(`/clubs/${data.clubId}`);
          }, 2000);
        },
      });
    }
  }, [isAuthenticated, token, joinViaInvite, isPending, isSuccess, isError, router]);

  // Show loading state while checking auth or joining
  if (authLoading || isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-md px-4 py-16">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-md px-4 py-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <CardTitle>Request Sent</CardTitle>
              </div>
              <CardDescription>
                The club owner can now review your request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Redirecting you to the club page...
              </p>
              <Button
                onClick={() => router.push('/clubs')}
                variant="outline"
                className="w-full"
              >
                Browse All Clubs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to join club';
    const isInvalidToken = errorMessage.includes('invalid') || errorMessage.includes('expired');
    const isAlreadyMember = errorMessage.includes('already a member');

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-md px-4 py-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <CardTitle>
                  {isAlreadyMember ? "Already a Member" : "Invalid Invite Link"}
                </CardTitle>
              </div>
              <CardDescription>
                {isAlreadyMember
                  ? "You're already a member of this club"
                  : isInvalidToken
                  ? "This invite link is invalid or has expired"
                  : errorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAlreadyMember ? (
                <Button
                  onClick={() => router.push('/clubs')}
                  className="w-full"
                >
                  View My Clubs
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {isInvalidToken
                      ? "Please ask the club admin for a new invite link."
                      : "Please try again or contact support."}
                  </p>
                  <Button
                    onClick={() => router.push('/clubs')}
                    variant="outline"
                    className="w-full"
                  >
                    Browse All Clubs
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Default loading state (shouldn't normally reach here)
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Processing Invite...</CardTitle>
            <CardDescription>Please wait while we process your request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
